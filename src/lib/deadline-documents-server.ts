import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeadlineDocument } from "@/lib/deadline-documents";

const DOCUMENT_SELECT_FIELDS =
  "id, created_at, deadline_id, user_id, file_name, file_path, file_size, mime_type";

export async function getDeadlineDocumentsByDeadlineId({
  supabase,
  userId,
  deadlineIds,
}: {
  supabase: SupabaseClient;
  userId: string;
  deadlineIds: number[];
}) {
  const uniqueDeadlineIds = Array.from(new Set(deadlineIds)).filter(Boolean);
  const documentsByDeadlineId = new Map<number, DeadlineDocument>();

  if (uniqueDeadlineIds.length === 0) {
    return documentsByDeadlineId;
  }

  const { data, error } = await supabase
    .from("deadline_documents")
    .select(DOCUMENT_SELECT_FIELDS)
    .in("deadline_id", uniqueDeadlineIds);

  if (error) {
    console.error(error);
    return documentsByDeadlineId;
  }

  const documents = (data ?? []) as DeadlineDocument[];

  documents.forEach((document) => {
    documentsByDeadlineId.set(Number(document.deadline_id), document);
  });

  return documentsByDeadlineId;
}

export async function getDeadlineDocumentByDeadlineId({
  supabase,
  userId,
  deadlineId,
}: {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
}) {
  const documentsByDeadlineId = await getDeadlineDocumentsByDeadlineId({
    supabase,
    userId,
    deadlineIds: [deadlineId],
  });

  return documentsByDeadlineId.get(deadlineId) ?? null;
}

export async function getDeadlineDocumentById({
  supabase,
  userId,
  documentId,
}: {
  supabase: SupabaseClient;
  userId: string;
  documentId: number;
}) {
  const { data, error } = await supabase
    .from("deadline_documents")
    .select(DOCUMENT_SELECT_FIELDS)
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  return (data as DeadlineDocument | null) ?? null;
}
