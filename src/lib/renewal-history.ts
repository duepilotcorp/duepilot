import type { SupabaseClient } from "@supabase/supabase-js";

export const RENEWAL_HISTORY_SELECT_FIELDS =
  "id, created_at, user_id, deadline_id, deadline_title, deadline_category, previous_due_date, new_due_date, previous_document_file_name, previous_document_file_size, previous_document_file_path, new_document_file_name, new_document_file_size, new_document_file_path, document_action, reminders, metadata";

export type RenewalDocumentAction =
  | "kept"
  | "added"
  | "replaced"
  | "removed"
  | "none";

export type RenewalHistory = {
  id: number;
  created_at: string;
  user_id: string;
  deadline_id: number;
  deadline_title: string;
  deadline_category: string | null;
  previous_due_date: string;
  new_due_date: string;
  previous_document_file_name: string | null;
  previous_document_file_size: number | null;
  previous_document_file_path: string | null;
  new_document_file_name: string | null;
  new_document_file_size: number | null;
  new_document_file_path: string | null;
  document_action: RenewalDocumentAction;
  reminders: number[] | null;
  metadata: Record<string, unknown> | null;
};

export type CreateRenewalHistoryParams = {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
  deadlineTitle: string;
  deadlineCategory?: string | null;
  previousDueDate: string;
  newDueDate: string;
  previousDocumentFileName?: string | null;
  previousDocumentFileSize?: number | null;
  previousDocumentFilePath?: string | null;
  newDocumentFileName?: string | null;
  newDocumentFileSize?: number | null;
  newDocumentFilePath?: string | null;
  documentAction: RenewalDocumentAction;
  reminders?: number[] | null;
  metadata?: Record<string, unknown>;
};

export async function createRenewalHistory({
  supabase,
  userId,
  deadlineId,
  deadlineTitle,
  deadlineCategory = null,
  previousDueDate,
  newDueDate,
  previousDocumentFileName = null,
  previousDocumentFileSize = null,
  previousDocumentFilePath = null,
  newDocumentFileName = null,
  newDocumentFileSize = null,
  newDocumentFilePath = null,
  documentAction,
  reminders = [],
  metadata = {},
}: CreateRenewalHistoryParams) {
  const { error } = await supabase.from("renewal_history").insert({
    user_id: userId,
    deadline_id: deadlineId,
    deadline_title: deadlineTitle,
    deadline_category: deadlineCategory,
    previous_due_date: previousDueDate,
    new_due_date: newDueDate,
    previous_document_file_name: previousDocumentFileName,
    previous_document_file_size: previousDocumentFileSize,
    previous_document_file_path: previousDocumentFilePath,
    new_document_file_name: newDocumentFileName,
    new_document_file_size: newDocumentFileSize,
    new_document_file_path: newDocumentFilePath,
    document_action: documentAction,
    reminders,
    metadata,
  });

  if (error) {
    console.warn("Unable to create renewal history", error);
    return { error };
  }

  return {};
}

export async function getDeadlineRenewalHistory({
  supabase,
  userId,
  deadlineId,
  limit = 20,
}: {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
  limit?: number;
}) {
  const { data, error } = await supabase
    .from("renewal_history")
    .select(RENEWAL_HISTORY_SELECT_FIELDS)
    .eq("deadline_id", deadlineId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []) as RenewalHistory[];
}
