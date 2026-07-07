import { NextRequest, NextResponse } from "next/server";
import { DEADLINE_DOCUMENTS_BUCKET } from "@/lib/deadline-documents";
import { getAccessibleDeadlineDocumentById } from "@/lib/deadline-security";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DeadlineDocumentRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function encodeContentDispositionFileName(fileName: string) {
  const cleanedFileName = fileName.replace(/["\\\r\n]/g, "").trim() || "document";
  const fallbackFileName =
    cleanedFileName.replace(/[^\x20-\x7E]/g, "_") || "document";
  const encodedFileName = encodeURIComponent(cleanedFileName).replace(
    /['()]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return `filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`;
}

export async function GET(
  request: NextRequest,
  { params }: DeadlineDocumentRouteProps
) {
  const { id } = await params;
  const documentId = Number(id);

  if (!Number.isInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentAccess = await getAccessibleDeadlineDocumentById({
    documentId,
    userId: user.id,
  });

  if (!documentAccess) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { document } = documentAccess;

  const { data: fileData, error: fileError } = await supabaseAdmin.storage
    .from(DEADLINE_DOCUMENTS_BUCKET)
    .download(document.file_path);

  if (fileError || !fileData) {
    console.error(fileError);
    return NextResponse.json(
      { error: "Unable to load file" },
      { status: 500 }
    );
  }

  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
  const fileName = document.file_name || "document";
  const arrayBuffer = await fileData.arrayBuffer();

  const contentType = document.mime_type || fileData.type || "application/octet-stream";

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(fileData.size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };

  if (shouldDownload) {
    headers["Content-Disposition"] = `attachment; ${encodeContentDispositionFileName(fileName)}`;
  } else {
    headers["Content-Disposition"] = "inline";
  }

  return new NextResponse(arrayBuffer, { headers });
}
