import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeadlineDocument } from "@/lib/deadline-documents";

const DOCUMENT_SELECT_FIELDS =
  "id, created_at, deadline_id, user_id, file_name, file_path, file_size, mime_type";

function sortDocuments(documents: DeadlineDocument[]) {
  return [...documents].sort((firstDocument, secondDocument) => {
    return new Date(secondDocument.created_at).getTime() - new Date(firstDocument.created_at).getTime();
  });
}

export async function getDeadlineDocumentListsByDeadlineId({
  supabase,
  userId,
  deadlineIds,
}: {
  supabase: SupabaseClient;
  userId: string;
  deadlineIds: number[];
}) {
  const uniqueDeadlineIds = Array.from(new Set(deadlineIds)).filter(Boolean);
  const documentsByDeadlineId = new Map<number, DeadlineDocument[]>();

  if (uniqueDeadlineIds.length === 0) {
    return documentsByDeadlineId;
  }

  const { data, error } = await supabase
    .from("deadline_documents")
    .select(DOCUMENT_SELECT_FIELDS)
    .in("deadline_id", uniqueDeadlineIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return documentsByDeadlineId;
  }

  const documents = (data ?? []) as DeadlineDocument[];

  documents.forEach((document) => {
    const deadlineId = Number(document.deadline_id);
    const existingDocuments = documentsByDeadlineId.get(deadlineId) ?? [];
    existingDocuments.push(document);
    documentsByDeadlineId.set(deadlineId, existingDocuments);
  });

  documentsByDeadlineId.forEach((deadlineDocuments, deadlineId) => {
    documentsByDeadlineId.set(deadlineId, sortDocuments(deadlineDocuments));
  });

  return documentsByDeadlineId;
}

export async function getDeadlineDocumentsByDeadlineId({
  supabase,
  userId,
  deadlineIds,
}: {
  supabase: SupabaseClient;
  userId: string;
  deadlineIds: number[];
}) {
  const documentListsByDeadlineId = await getDeadlineDocumentListsByDeadlineId({
    supabase,
    userId,
    deadlineIds,
  });
  const primaryDocumentsByDeadlineId = new Map<number, DeadlineDocument>();

  documentListsByDeadlineId.forEach((documents, deadlineId) => {
    const primaryDocument = documents[0];

    if (primaryDocument) {
      primaryDocumentsByDeadlineId.set(deadlineId, primaryDocument);
    }
  });

  return primaryDocumentsByDeadlineId;
}

export async function getDeadlineDocumentListByDeadlineId({
  supabase,
  userId,
  deadlineId,
}: {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
}) {
  const documentsByDeadlineId = await getDeadlineDocumentListsByDeadlineId({
    supabase,
    userId,
    deadlineIds: [deadlineId],
  });

  return documentsByDeadlineId.get(deadlineId) ?? [];
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
  const documents = await getDeadlineDocumentListByDeadlineId({
    supabase,
    userId,
    deadlineId,
  });

  return documents[0] ?? null;
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
