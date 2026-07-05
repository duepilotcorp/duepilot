export const DEADLINE_DOCUMENTS_BUCKET = "deadline-documents";
export const MAX_DEADLINE_DOCUMENT_SIZE = 25 * 1024 * 1024;

export const ALLOWED_DEADLINE_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const ALLOWED_DEADLINE_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
] as const;

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

export function getDeadlineDocumentExtension(fileName: string) {
  const lowerFileName = fileName.toLowerCase();
  const extension = ALLOWED_DEADLINE_DOCUMENT_EXTENSIONS.find((allowedExtension) =>
    lowerFileName.endsWith(allowedExtension)
  );

  return extension ?? "";
}

export function getDeadlineDocumentMimeType(file: File) {
  const lowerFileName = file.name.toLowerCase();

  if (file.type && ALLOWED_DEADLINE_DOCUMENT_TYPES.includes(file.type as (typeof ALLOWED_DEADLINE_DOCUMENT_TYPES)[number])) {
    return file.type;
  }

  if (lowerFileName.endsWith(".pdf")) return "application/pdf";
  if (lowerFileName.endsWith(".png")) return "image/png";
  if (lowerFileName.endsWith(".jpg") || lowerFileName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerFileName.endsWith(".webp")) return "image/webp";

  return "";
}

export function isDeadlineDocumentImage(mimeType: string | null | undefined, fileName = "") {
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";
  const lowerFileName = fileName.toLowerCase();

  return (
    normalizedMimeType.startsWith("image/") ||
    lowerFileName.endsWith(".png") ||
    lowerFileName.endsWith(".jpg") ||
    lowerFileName.endsWith(".jpeg") ||
    lowerFileName.endsWith(".webp")
  );
}

export function isDeadlineDocumentPdf(mimeType: string | null | undefined, fileName = "") {
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";
  const lowerFileName = fileName.toLowerCase();

  return normalizedMimeType === "application/pdf" || lowerFileName.endsWith(".pdf");
}

export function getDeadlineDocumentFormatLabel(mimeType: string | null | undefined, fileName = "") {
  if (isDeadlineDocumentPdf(mimeType, fileName)) return "PDF";
  if (isDeadlineDocumentImage(mimeType, fileName)) return "Image";
  return "Document";
}

export function validateDeadlineDocumentFile(file: File) {
  const mimeType = getDeadlineDocumentMimeType(file);

  if (!mimeType) {
    return "Le document doit être un fichier PDF, PNG, JPG, JPEG ou WEBP.";
  }

  if (file.size > MAX_DEADLINE_DOCUMENT_SIZE) {
    return "Le document ne doit pas dépasser 25 Mo.";
  }

  return null;
}

export function sanitizeDeadlineDocumentFileName(fileName: string) {
  const detectedExtension = getDeadlineDocumentExtension(fileName);
  const extension = detectedExtension || ".pdf";
  const fileNameWithoutExtension = detectedExtension
    ? fileName.slice(0, fileName.length - detectedExtension.length)
    : fileName;
  const cleanedName = fileNameWithoutExtension
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${cleanedName || "document"}${extension}`;
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
