"use server";

import { revalidatePath } from "next/cache";
import {
  canEditDeadlineTreatment,
  normalizeDeadlineVisibility,
  normalizeDeadlineWorkflowStatus,
} from "@/lib/deadline-access";
import { ensureUserOrganization } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";

type UpdateChecklistItemCompletionInput = {
  deadlineId: number;
  itemId: number;
  isCompleted: boolean;
};

type DeadlineTreatmentAccessDeadline = {
  id: number;
  user_id: string | null;
  organization_id: string | null;
  visibility: string | null;
  workflow_status: string | null;
  claimed_by: string | null;
};

export async function updateDeadlineChecklistItemCompletion({
  deadlineId,
  itemId,
  isCompleted,
}: UpdateChecklistItemCompletionInput) {
  if (!Number.isInteger(deadlineId) || deadlineId <= 0) {
    return { ok: false, message: "Échéance invalide." } as const;
  }

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return { ok: false, message: "Élément de checklist invalide." } as const;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Session expirée. Reconnectez-vous." } as const;
  }

  const userOrganization = await ensureUserOrganization({
    userId: user.id,
    email: user.email,
  });

  const { data: deadline, error: deadlineError } = await supabase
    .from("deadlines")
    .select("id, user_id, organization_id, visibility, workflow_status, claimed_by")
    .eq("id", deadlineId)
    .maybeSingle();

  if (deadlineError || !deadline) {
    console.error(deadlineError);
    return {
      ok: false,
      message: "Impossible de vérifier les droits sur cette échéance.",
    } as const;
  }

  const typedDeadline = deadline as DeadlineTreatmentAccessDeadline;
  const visibility = normalizeDeadlineVisibility(typedDeadline.visibility);
  const workflowStatus = normalizeDeadlineWorkflowStatus(typedDeadline.workflow_status);
  const isReadablePersonalDeadline =
    visibility === "personal" && typedDeadline.user_id === user.id;
  const isReadableTeamDeadline =
    visibility === "team" &&
    Boolean(userOrganization?.organization.id) &&
    typedDeadline.organization_id === userOrganization?.organization.id;

  if (!isReadablePersonalDeadline && !isReadableTeamDeadline) {
    return {
      ok: false,
      message: "Vous n’avez pas accès à cette échéance.",
    } as const;
  }

  const canEdit = canEditDeadlineTreatment({
    visibility,
    ownerId: typedDeadline.user_id,
    userId: user.id,
    organizationRole: userOrganization?.membership.role,
    workflowStatus,
    claimedBy: typedDeadline.claimed_by,
  });

  if (!canEdit) {
    return {
      ok: false,
      message:
        "Cette checklist est verrouillée pour votre rôle ou parce qu’un autre membre prend déjà en charge l’échéance.",
    } as const;
  }

  const completedAt = isCompleted ? new Date().toISOString() : null;
  const completedBy = isCompleted ? user.id : null;
  const { error: updateError } = await supabase
    .from("deadline_checklist_items")
    .update({
      is_completed: isCompleted,
      completed_at: completedAt,
      completed_by: completedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("deadline_id", deadlineId);

  if (updateError) {
    console.error(updateError);
    return {
      ok: false,
      message: "Impossible de mettre à jour cette checklist pour le moment.",
    } as const;
  }

  revalidatePath(`/deadlines/${deadlineId}`);
  revalidatePath("/dashboard");

  return {
    ok: true,
    completedAt,
    completedBy,
  } as const;
}
