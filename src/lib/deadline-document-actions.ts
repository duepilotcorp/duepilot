import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDeadlineDocumentStoragePath,
  DEADLINE_DOCUMENTS_BUCKET,
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

  const { error: uploadError } = await supabase.storage
    .from(DEADLINE_DOCUMENTS_BUCKET)
    .upload(filePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error(uploadError);
    return {
      errorMessage:
        "Impossible d’envoyer ce PDF pour le moment. Vérifiez le fichier puis réessayez.",
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
        mime_type: "application/pdf",
      },
      { onConflict: "deadline_id" }
    );

  if (documentError) {
    console.error(documentError);

    await supabase.storage.from(DEADLINE_DOCUMENTS_BUCKET).remove([filePath]);

    return {
      errorMessage:
        "Le PDF a été envoyé, mais DuePilot n’a pas pu l’associer à l’échéance. Réessayez dans quelques instants.",
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
    .eq("deadline_id", deadlineId)
    .eq("user_id", userId);

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
