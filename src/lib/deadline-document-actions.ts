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

type DeleteDeadlineDocumentParams = {
  supabase: SupabaseClient;
  userId: string;
  deadlineId: number;
  filePath?: string | null;
};

export async function saveDeadlineDocument({
  supabase,
  userId,
  deadlineId,
  file,
  previousFilePath,
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

  const { error: documentError } = await supabase
    .from("deadline_documents")
    .upsert(
      {
        deadline_id: deadlineId,
        user_id: userId,
        file_name: file.name.trim() || "document.pdf",
        file_path: filePath,
        file_size: file.size,
        mime_type: mimeType,
      },
      { onConflict: "deadline_id" }
    );

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
        documentError.code === "23514"
          ? "Ce format de document n’est pas encore autorisé par la base DuePilot. Exécutez le correctif Supabase puis réessayez."
          : "Le document a été envoyé, mais DuePilot n’a pas pu l’associer à l’échéance. Réessayez dans quelques instants.",
    };
  }

  if (previousFilePath && previousFilePath !== filePath) {
    const { error: cleanupError } = await supabase.storage
      .from(DEADLINE_DOCUMENTS_BUCKET)
      .remove([previousFilePath]);

    if (cleanupError) {
      console.warn(cleanupError);
    }
  }

  return { filePath };
}

export async function deleteDeadlineDocument({
  supabase,
  userId,
  deadlineId,
  filePath,
}: DeleteDeadlineDocumentParams) {
  const { error: deleteRowError } = await supabase
    .from("deadline_documents")
    .delete()
    .eq("deadline_id", deadlineId);

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
