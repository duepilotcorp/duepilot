import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDeadlineDocumentStoragePath,
  DEADLINE_DOCUMENTS_BUCKET,
  getDeadlineDocumentMimeType,
  validateDeadlineDocumentFile,
} from "@/lib/deadline-documents";

type SaveDeadlineDocumentParams = {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
  file: File;
  previousFilePath?: string | null;
};

type SaveDeadlineDocumentsParams = {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
  files: File[];
};

type DeleteDeadlineDocumentParams = {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
  documentId?: number | null;
  filePath?: string | null;
};

type DeleteDeadlineDocumentsParams = {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
  documents: Array<{
    id: number;
    file_path: string | null;
  }>;
};

export async function saveDeadlineDocument({
  supabase,
  userId,
  deadlineId,
  file,
}: SaveDeadlineDocumentParams) {
  const validationError = validateDeadlineDocumentFile(file);

  if (validationError) {
    return { errorMessage: validationError };
  }

  const filePath = buildDeadlineDocumentStoragePath({
    userId,
    deadlineId,
    fileName: file.name,
  });

  const mimeType = getDeadlineDocumentMimeType(file) || "application/octet-stream";

  const { error: uploadError } = await supabase.storage
    .from(DEADLINE_DOCUMENTS_BUCKET)
    .upload(filePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error(uploadError);
    return {
      errorMessage:
        "Impossible d’envoyer ce document pour le moment. Vérifiez le fichier puis réessayez.",
    };
  }

  const { data: document, error: documentError } = await supabase
    .from("deadline_documents")
    .insert({
      deadline_id: deadlineId,
      user_id: userId,
      file_name: file.name.trim() || "document.pdf",
      file_path: filePath,
      file_size: file.size,
      mime_type: mimeType,
    })
    .select("id, created_at, deadline_id, user_id, file_name, file_path, file_size, mime_type")
    .single();

  if (documentError) {
    console.error("Deadline document association failed", {
      code: documentError.code,
      message: documentError.message,
      details: documentError.details,
      hint: documentError.hint,
    });

    await supabase.storage.from(DEADLINE_DOCUMENTS_BUCKET).remove([filePath]);

    return {
      errorMessage:
        documentError.code === "23505"
          ? "La base DuePilot limite encore cette échéance à un seul document. Exécutez le correctif Supabase multi-documents puis réessayez."
          : documentError.code === "23514"
            ? "Ce format de document n’est pas encore autorisé par la base DuePilot. Exécutez le correctif Supabase puis réessayez."
            : "Le document a été envoyé, mais DuePilot n’a pas pu l’associer à l’échéance. Réessayez dans quelques instants.",
    };
  }

  return { filePath, document };
}

export async function saveDeadlineDocuments({
  supabase,
  userId,
  deadlineId,
  files,
}: SaveDeadlineDocumentsParams) {
  const savedDocuments = [];

  for (const file of files) {
    const result = await saveDeadlineDocument({
      supabase,
      userId,
      deadlineId,
      file,
    });

    if (result.errorMessage) {
      return {
        errorMessage: result.errorMessage,
        documents: savedDocuments,
      };
    }

    if (result.document) {
      savedDocuments.push(result.document);
    }
  }

  return { documents: savedDocuments };
}

export async function deleteDeadlineDocument({
  supabase,
  userId,
  deadlineId,
  documentId,
  filePath,
}: DeleteDeadlineDocumentParams) {
  const deleteQuery = supabase
    .from("deadline_documents")
    .delete()
    .eq("deadline_id", deadlineId);

  const { error: deleteRowError } = documentId
    ? await deleteQuery.eq("id", documentId)
    : await deleteQuery;

  if (deleteRowError) {
    console.error(deleteRowError);
    return {
      errorMessage:
        "Impossible de supprimer le document associé pour le moment. Réessayez dans quelques instants.",
    };
  }

  if (filePath) {
    const { error: storageError } = await supabase.storage
      .from(DEADLINE_DOCUMENTS_BUCKET)
      .remove([filePath]);

    if (storageError) {
      console.warn(storageError);
    }
  }

  return {};
}

export async function deleteDeadlineDocuments({
  supabase,
  deadlineId,
  documents,
}: DeleteDeadlineDocumentsParams) {
  if (documents.length === 0) {
    return {};
  }

  const documentIds = documents.map((document) => document.id);
  const filePaths = documents
    .map((document) => document.file_path)
    .filter((filePath): filePath is string => Boolean(filePath));

  const { error: deleteRowsError } = await supabase
    .from("deadline_documents")
    .delete()
    .eq("deadline_id", deadlineId)
    .in("id", documentIds);

  if (deleteRowsError) {
    console.error(deleteRowsError);
    return {
      errorMessage:
        "Impossible de supprimer les documents sélectionnés pour le moment. Réessayez dans quelques instants.",
    };
  }

  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(DEADLINE_DOCUMENTS_BUCKET)
      .remove(filePaths);

    if (storageError) {
      console.warn(storageError);
    }
  }

  return {};
}
