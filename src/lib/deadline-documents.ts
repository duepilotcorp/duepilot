export const DEADLINE_DOCUMENTS_BUCKET = "deadline-documents";
export const MAX_DEADLINE_DOCUMENT_SIZE = 25 * 1024 * 1024;

export type DeadlineDocument = {
  id: number;
  created_at: string;
  deadline_id: number;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  signedUrl?: string | null;
};

export function formatFileSize(size: number | null | undefined) {
  if (!size || size <= 0) return "Taille inconnue";

  const megabytes = size / (1024 * 1024);

  if (megabytes >= 1) {
    return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} Mo`;
  }

  const kilobytes = size / 1024;
  return `${Math.max(1, Math.round(kilobytes))} Ko`;
}

export function validateDeadlineDocumentFile(file: File) {
  const lowerFileName = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || lowerFileName.endsWith(".pdf");

  if (!isPdf) {
    return "Le document doit être un fichier PDF.";
  }

  if (file.size > MAX_DEADLINE_DOCUMENT_SIZE) {
    return "Le document ne doit pas dépasser 25 Mo.";
  }

  return null;
}

export function sanitizeDeadlineDocumentFileName(fileName: string) {
  const cleanedName = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const safeName = cleanedName || "document.pdf";
  return safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`;
}

export function buildDeadlineDocumentStoragePath({
  userId,
  deadlineId,
  fileName,
}: {
  userId: string;
  deadlineId: number | string;
  fileName: string;
}) {
  const safeFileName = sanitizeDeadlineDocumentFileName(fileName);
  return `${userId}/${deadlineId}/${crypto.randomUUID()}-${safeFileName}`;
}
