"use server";

import { revalidatePath } from "next/cache";
import { createActivityLog } from "@/lib/activity-logs";
import {
  canContributeToTeamDeadlines,
  canManageTeamDeadlines,
  normalizeDeadlineVisibility,
  normalizeDeadlineWorkflowStatus,
  type DeadlineVisibility,
  type DeadlineWorkflowStatus,
} from "@/lib/deadline-access";
import { ensureUserOrganization } from "@/lib/organizations";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type WorkflowAction = "claim" | "unclaim" | "complete" | "reopen" | "validate";

type DeadlineWorkflowRow = {
  id: number;
  title: string;
  user_id: string | null;
  organization_id: string | null;
  visibility: string | null;
  workflow_status: string | null;
  claimed_by: string | null;
  claimed_at?: string | null;
  completed_by: string | null;
  completed_at?: string | null;
  archived_by?: string | null;
  archived_at?: string | null;
};

function getWorkflowUpdate({
  action,
  userId,
  visibility,
}: {
  action: WorkflowAction;
  userId: string;
  visibility: DeadlineVisibility;
}) {
  const now = new Date().toISOString();

  if (action === "claim") {
    return {
      workflow_status: "in_progress" satisfies DeadlineWorkflowStatus,
      claimed_by: userId,
      claimed_at: now,
      completed_by: null,
      completed_at: null,
      archived_by: null,
      archived_at: null,
    };
  }

  if (action === "unclaim") {
    return {
      workflow_status: "open" satisfies DeadlineWorkflowStatus,
      claimed_by: null,
      claimed_at: null,
      completed_by: null,
      completed_at: null,
      archived_by: null,
      archived_at: null,
    };
  }

  if (action === "complete" && visibility === "personal") {
    return {
      workflow_status: "archived" satisfies DeadlineWorkflowStatus,
      completed_by: userId,
      completed_at: now,
      claimed_by: userId,
      claimed_at: now,
      archived_by: userId,
      archived_at: now,
    };
  }

  if (action === "complete") {
    return {
      workflow_status: "completed" satisfies DeadlineWorkflowStatus,
      completed_by: userId,
      completed_at: now,
      claimed_by: userId,
      claimed_at: now,
      archived_by: null,
      archived_at: null,
    };
  }

  if (action === "validate") {
    return {
      workflow_status: "archived" satisfies DeadlineWorkflowStatus,
      archived_by: userId,
      archived_at: now,
    };
  }

  return {
    workflow_status: "open" satisfies DeadlineWorkflowStatus,
    claimed_by: null,
    claimed_at: null,
    completed_by: null,
    completed_at: null,
    archived_by: null,
    archived_at: null,
  };
}

function getActivityCopy({
  action,
  title,
  visibility,
}: {
  action: WorkflowAction;
  title: string;
  visibility: DeadlineVisibility;
}) {
  if (action === "claim") {
    return {
      action: "deadline.claimed" as const,
      title: "Échéance prise en charge",
      description: `${title} est maintenant en cours de traitement.`,
    };
  }

  if (action === "unclaim") {
    return {
      action: "deadline.unclaimed" as const,
      title: "Prise en charge annulée",
      description: `${title} a été remise dans la liste des actions à traiter.`,
    };
  }

  if (action === "complete" && visibility === "personal") {
    return {
      action: "deadline.personal_completed" as const,
      title: "Échéance personnelle archivée",
      description: `${title} a été marquée comme faite et déplacée dans l’historique.`,
    };
  }

  if (action === "complete") {
    return {
      action: "deadline.completed" as const,
      title: "Échéance faite, en attente de validation",
      description: `${title} a été indiquée comme faite par un membre de l’équipe.`,
    };
  }

  if (action === "validate") {
    return {
      action: "deadline.validated" as const,
      title: "Échéance validée et archivée",
      description: `${title} a été validée par un administrateur et déplacée dans l’historique.`,
    };
  }

  return {
    action: "deadline.reopened" as const,
    title: "Échéance remise à traiter",
    description: `${title} a été remise dans la liste des actions à traiter.`,
  };
}

function canRunAction({
  action,
  visibility,
  status,
  isOwner,
  canContribute,
  canManage,
  claimedByUser,
  completedByUser,
}: {
  action: WorkflowAction;
  visibility: DeadlineVisibility;
  status: DeadlineWorkflowStatus;
  isOwner: boolean;
  canContribute: boolean;
  canManage: boolean;
  claimedByUser: boolean;
  completedByUser: boolean;
}) {
  if (visibility === "personal") {
    if (!isOwner) return false;
    if (action === "validate") return false;
    if (action === "claim") return status === "open";
    if (action === "unclaim") return status === "in_progress";
    if (action === "complete") return status === "open" || status === "in_progress";
    if (action === "reopen") return status === "archived" || status === "completed";
    return false;
  }

  if (action === "claim") {
    return canContribute && status === "open";
  }

  if (action === "unclaim") {
    return status === "in_progress" && (canManage || claimedByUser);
  }

  if (action === "complete") {
    return canContribute && (status === "open" || status === "in_progress");
  }

  if (action === "reopen") {
    if (status === "completed") return canManage || completedByUser;
    if (status === "archived") return canManage;
    return canManage && status !== "open";
  }

  if (action === "validate") {
    return canManage && status === "completed";
  }

  return false;
}

export async function updateDeadlineWorkflow({
  deadlineId,
  action,
}: {
  deadlineId: number;
  action: WorkflowAction;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "Vous devez être connecté pour effectuer cette action.",
    };
  }

  const userOrganization = await ensureUserOrganization({
    userId: user.id,
    email: user.email,
  });

  const { data: deadline, error: deadlineError } = await supabaseAdmin
    .from("deadlines")
    .select(
      "id, title, user_id, organization_id, visibility, workflow_status, claimed_by, claimed_at, completed_by, completed_at, archived_by, archived_at"
    )
    .eq("id", deadlineId)
    .maybeSingle();

  if (deadlineError || !deadline) {
    console.error(deadlineError);
    return {
      success: false,
      message: "Cette échéance est introuvable.",
    };
  }

  const typedDeadline = deadline as DeadlineWorkflowRow;
  const visibility = normalizeDeadlineVisibility(typedDeadline.visibility);
  const status = normalizeDeadlineWorkflowStatus(typedDeadline.workflow_status);
  const role = userOrganization?.membership.role;
  const isOwner = typedDeadline.user_id === user.id;
  const sameOrganization = Boolean(
    userOrganization?.organization.id &&
      typedDeadline.organization_id === userOrganization.organization.id
  );

  if (visibility === "team" && !sameOrganization) {
    return {
      success: false,
      message: "Cette échéance d’équipe n’appartient pas à votre entreprise active.",
    };
  }

  if (visibility === "personal" && !isOwner) {
    return {
      success: false,
      message: "Vous ne pouvez agir que sur vos propres échéances personnelles.",
    };
  }

  const canContribute = canContributeToTeamDeadlines(role);
  const canManage = canManageTeamDeadlines(role);
  const claimedByUser = typedDeadline.claimed_by === user.id;
  const completedByUser = typedDeadline.completed_by === user.id;

  const allowed = canRunAction({
    action,
    visibility,
    status,
    isOwner,
    canContribute,
    canManage,
    claimedByUser,
    completedByUser,
  });

  if (!allowed) {
    return {
      success: false,
      message: "Votre rôle ne permet pas d’effectuer cette action dans l’état actuel.",
    };
  }

  const updatePayload = getWorkflowUpdate({ action, userId: user.id, visibility });
  const { error: updateError } = await supabaseAdmin
    .from("deadlines")
    .update(updatePayload)
    .eq("id", deadlineId);

  if (updateError) {
    console.error(updateError);
    return {
      success: false,
      message: "Impossible de mettre à jour le suivi pour le moment.",
    };
  }

  const activityCopy = getActivityCopy({ action, title: typedDeadline.title, visibility });
  await createActivityLog({
    supabase: supabaseAdmin,
    userId: user.id,
    deadlineId,
    action: activityCopy.action,
    title: activityCopy.title,
    description: activityCopy.description,
    metadata: {
      actor_email: user.email ?? null,
      previous_status: status,
      new_status: updatePayload.workflow_status,
      visibility,
      role: role ?? null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/deadlines");
  revalidatePath(`/deadlines/${deadlineId}`);

  const messages: Record<WorkflowAction, string> = {
    claim: "Échéance prise en charge.",
    unclaim: "Prise en charge annulée.",
    complete:
      visibility === "personal"
        ? "Échéance personnelle marquée comme faite et déplacée dans l’historique."
        : "Échéance indiquée comme faite. Elle attend la validation d’un administrateur.",
    reopen: "Échéance remise à traiter.",
    validate: "Échéance validée et déplacée dans l’historique.",
  };

  return {
    success: true,
    message: messages[action],
  };
}

export const updateTeamDeadlineWorkflow = updateDeadlineWorkflow;
