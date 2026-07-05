import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVITY_LOG_SELECT_FIELDS =
  "id, created_at, user_id, deadline_id, action, title, description, metadata";

export type ActivityLogAction =
  | "deadline.created"
  | "deadline.updated"
  | "deadline.deleted"
  | "deadline.title_updated"
  | "deadline.category_updated"
  | "deadline.due_date_updated"
  | "deadline.reminders_updated"
  | "deadline.renewed"
  | "deadline.claimed"
  | "deadline.unclaimed"
  | "deadline.completed"
  | "deadline.personal_completed"
  | "deadline.validated"
  | "deadline.reopened"
  | "document.added"
  | "document.replaced"
  | "document.removed"
  | "notification.sent";

export type ActivityLog = {
  id: number;
  created_at: string;
  user_id: string;
  deadline_id: number | null;
  action: ActivityLogAction | string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
};

export type CreateActivityLogParams = {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
  action: ActivityLogAction;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export async function createActivityLog({
  supabase,
  userId,
  deadlineId,
  action,
  title,
  description,
  metadata = {},
}: CreateActivityLogParams) {
  const { error } = await supabase.from("activity_logs").insert({
    user_id: userId,
    deadline_id: deadlineId,
    action,
    title,
    description: description ?? null,
    metadata,
  });

  if (error) {
    console.warn("Unable to create activity log", error);
    return { error };
  }

  return {};
}

export async function createActivityLogs(
  logs: CreateActivityLogParams[]
) {
  if (logs.length === 0) {
    return {};
  }

  const [{ supabase }] = logs;

  const { error } = await supabase.from("activity_logs").insert(
    logs.map(
      ({
        userId,
        deadlineId,
        action,
        title,
        description,
        metadata = {},
      }) => ({
        user_id: userId,
        deadline_id: deadlineId,
        action,
        title,
        description: description ?? null,
        metadata,
      })
    )
  );

  if (error) {
    console.warn("Unable to create activity logs", error);
    return { error };
  }

  return {};
}

export async function getDeadlineActivityLogs({
  supabase,
  userId,
  deadlineId,
  limit = 12,
}: {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
  limit?: number;
}) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select(ACTIVITY_LOG_SELECT_FIELDS)
    .eq("deadline_id", deadlineId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []) as ActivityLog[];
}

export function getActivityLogTone(action: string) {
  if (action.startsWith("document.")) {
    return "border-blue-400/20 bg-blue-400/10 text-blue-100";
  }

  if (action.startsWith("notification.")) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  if (
    action === "deadline.renewed" ||
    action === "deadline.completed" ||
    action === "deadline.personal_completed" ||
    action === "deadline.validated"
  ) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  if (action === "deadline.claimed") {
    return "border-yellow-400/20 bg-yellow-400/10 text-yellow-100";
  }

  if (action === "deadline.reopened" || action === "deadline.unclaimed") {
    return "border-blue-400/20 bg-blue-400/10 text-blue-100";
  }

  if (action === "deadline.deleted") {
    return "border-red-400/20 bg-red-400/10 text-red-100";
  }

  return "border-white/10 bg-white/[0.04] text-slate-100";
}
