import type { UserOrganization } from "@/lib/organizations";
import { getUserOrganization } from "@/lib/organizations";
import {
  canEditDeadline,
  canEditDeadlineTreatment,
  canDeleteDeadline,
  normalizeDeadlineVisibility,
  normalizeDeadlineWorkflowStatus,
} from "@/lib/deadline-access";
import type { DeadlineDocument } from "@/lib/deadline-documents";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type DeadlineSecurityRow = {
  id: number;
  user_id: string | null;
  organization_id: string | null;
  visibility: string | null;
  workflow_status: string | null;
  claimed_by?: string | null;
};

export type DeadlineDocumentSecurityRow = DeadlineDocument & {
  user_id: string;
};

export type DeadlineAccessLevel = {
  canRead: boolean;
  canEdit: boolean;
  canEditTreatment: boolean;
  canDelete: boolean;
  isPersonalOwner: boolean;
  isTeamMember: boolean;
  isTeamManager: boolean;
};

export function getDeadlineAccessLevel({
  deadline,
  userId,
  userOrganization,
}: {
  deadline: DeadlineSecurityRow;
  userId: string;
  userOrganization?: UserOrganization | null;
}): DeadlineAccessLevel {
  const visibility = normalizeDeadlineVisibility(deadline.visibility);
  const workflowStatus = normalizeDeadlineWorkflowStatus(deadline.workflow_status);
  const organizationRole = userOrganization?.membership.role;
  const organizationId = userOrganization?.organization.id ?? null;
  const isPersonalOwner = visibility === "personal" && deadline.user_id === userId;
  const isTeamMember =
    visibility === "team" &&
    Boolean(organizationId) &&
    deadline.organization_id === organizationId &&
    userOrganization?.membership.status === "active";
  const isTeamManager =
    isTeamMember && (organizationRole === "owner" || organizationRole === "admin");
  const canRead = isPersonalOwner || isTeamMember;

  return {
    canRead,
    canEdit:
      canRead &&
      canEditDeadline({
        visibility,
        ownerId: deadline.user_id,
        userId,
        organizationRole,
        workflowStatus,
      }),
    canEditTreatment:
      canRead &&
      canEditDeadlineTreatment({
        visibility,
        ownerId: deadline.user_id,
        userId,
        organizationRole,
        workflowStatus,
        claimedBy: deadline.claimed_by,
      }),
    canDelete:
      canRead &&
      canDeleteDeadline({
        visibility,
        ownerId: deadline.user_id,
        userId,
        organizationRole,
      }),
    isPersonalOwner,
    isTeamMember,
    isTeamManager,
  };
}

export async function getAccessibleDeadlineDocumentById({
  documentId,
  userId,
  userOrganization,
}: {
  documentId: number;
  userId: string;
  userOrganization?: UserOrganization | null;
}) {
  const { data: document, error: documentError } = await supabaseAdmin
    .from("deadline_documents")
    .select("id, created_at, deadline_id, user_id, file_name, file_path, file_size, mime_type")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError) {
    console.error(documentError);
    return null;
  }

  if (!document?.deadline_id) {
    return null;
  }

  const { data: deadline, error: deadlineError } = await supabaseAdmin
    .from("deadlines")
    .select("id, user_id, organization_id, visibility, workflow_status, claimed_by")
    .eq("id", document.deadline_id)
    .maybeSingle();

  if (deadlineError) {
    console.error(deadlineError);
    return null;
  }

  if (!deadline) {
    return null;
  }

  const resolvedUserOrganization = userOrganization ?? (await getUserOrganization(userId));
  const access = getDeadlineAccessLevel({
    deadline: deadline as DeadlineSecurityRow,
    userId,
    userOrganization: resolvedUserOrganization,
  });

  if (!access.canRead) {
    return null;
  }

  return {
    document: document as DeadlineDocumentSecurityRow,
    deadline: deadline as DeadlineSecurityRow,
    access,
  };
}
