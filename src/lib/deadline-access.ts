import type { OrganizationMemberRole } from "@/lib/organizations";

export const DEADLINE_VISIBILITIES = ["personal", "team"] as const;
export type DeadlineVisibility = (typeof DEADLINE_VISIBILITIES)[number];

export const DEADLINE_WORKFLOW_STATUSES = [
  "open",
  "in_progress",
  "completed",
  "archived",
] as const;
export type DeadlineWorkflowStatus = (typeof DEADLINE_WORKFLOW_STATUSES)[number];

export const DEADLINE_VISIBILITY_LABELS: Record<DeadlineVisibility, string> = {
  personal: "Personnel",
  team: "Équipe",
};

export const DEADLINE_WORKFLOW_LABELS: Record<DeadlineWorkflowStatus, string> = {
  open: "À traiter",
  in_progress: "En cours",
  completed: "À valider",
  archived: "Historique",
};

export function getDeadlineWorkflowLabel({
  status,
  visibility,
}: {
  status: DeadlineWorkflowStatus;
  visibility: DeadlineVisibility;
}) {
  if (status === "completed" && visibility === "team") return "À valider";
  if (status === "completed" && visibility === "personal") return "Faite";
  return DEADLINE_WORKFLOW_LABELS[status];
}

export function normalizeDeadlineVisibility(
  value: string | null | undefined
): DeadlineVisibility {
  return value === "team" ? "team" : "personal";
}

export function normalizeDeadlineWorkflowStatus(
  value: string | null | undefined
): DeadlineWorkflowStatus {
  if (value === "in_progress" || value === "completed" || value === "archived") {
    return value;
  }

  return "open";
}

export function isDeadlineArchived(value: string | null | undefined) {
  return normalizeDeadlineWorkflowStatus(value) === "archived";
}

export function canManageTeamDeadlines(role: OrganizationMemberRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canContributeToTeamDeadlines(
  role: OrganizationMemberRole | null | undefined
) {
  return role === "owner" || role === "admin" || role === "member";
}

export function canEditDeadline({
  visibility,
  ownerId,
  userId,
  organizationRole,
  workflowStatus,
}: {
  visibility: DeadlineVisibility;
  ownerId: string | null | undefined;
  userId: string;
  organizationRole: OrganizationMemberRole | null | undefined;
  workflowStatus?: DeadlineWorkflowStatus | string | null;
}) {
  if (normalizeDeadlineWorkflowStatus(workflowStatus) === "archived") return false;
  if (visibility === "team") return canManageTeamDeadlines(organizationRole);
  return ownerId === userId;
}

export function canDeleteDeadline({
  visibility,
  ownerId,
  userId,
  organizationRole,
}: {
  visibility: DeadlineVisibility;
  ownerId: string | null | undefined;
  userId: string;
  organizationRole: OrganizationMemberRole | null | undefined;
}) {
  if (visibility === "team") return canManageTeamDeadlines(organizationRole);
  return ownerId === userId;
}

export function getDeadlineVisibilityBadgeClassName(visibility: DeadlineVisibility) {
  if (visibility === "team") {
    return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  }

  return "border-violet-400/25 bg-violet-400/10 text-violet-100";
}

export function getDeadlineWorkflowBadgeClassName(status: DeadlineWorkflowStatus) {
  if (status === "archived") {
    return "border-slate-400/25 bg-slate-400/10 text-slate-100";
  }

  if (status === "completed") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  }

  if (status === "in_progress") {
    return "border-yellow-400/25 bg-yellow-400/10 text-yellow-100";
  }

  return "border-white/10 bg-white/[0.04] text-slate-200";
}

export function getDeadlineWorkflowAccentClassName(status: DeadlineWorkflowStatus) {
  if (status === "archived") return "border-slate-500/20 bg-slate-500/10";
  if (status === "completed") return "border-emerald-400/25 bg-emerald-400/10";
  if (status === "in_progress") return "border-yellow-400/25 bg-yellow-400/10";
  return "border-blue-400/20 bg-blue-400/10";
}

export function buildDeadlineAccessOrFilter({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId?: string | null;
}) {
  if (organizationId) {
    return `user_id.eq.${userId},and(visibility.eq.team,organization_id.eq.${organizationId})`;
  }

  return `user_id.eq.${userId}`;
}
