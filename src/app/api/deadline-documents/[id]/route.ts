import { NextRequest, NextResponse } from "next/server";
import { DEADLINE_DOCUMENTS_BUCKET } from "@/lib/deadline-documents";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DeadlineDocumentRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

type DeadlineDocumentRow = {
  id: number;
  user_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
};

function encodeContentDispositionFileName(fileName: string) {
  const cleanedFileName = fileName.replace(/["\\\r\n]/g, "").trim() || "document.pdf";
  const fallbackFileName =
    cleanedFileName.replace(/[^\x20-\x7E]/g, "_") || "document.pdf";
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

  const { data: document, error: documentError } = await supabase
    .from("deadline_documents")
    .select("id, user_id, file_name, file_path, mime_type")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (documentError) {
    console.error(documentError);
    return NextResponse.json(
      { error: "Unable to load document" },
      { status: 500 }
    );
  }

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const deadlineDocument = document as DeadlineDocumentRow;

  const { data: fileData, error: fileError } = await supabase.storage
    .from(DEADLINE_DOCUMENTS_BUCKET)
    .download(deadlineDocument.file_path);

  if (fileError || !fileData) {
    console.error(fileError);
    return NextResponse.json(
      { error: "Unable to load file" },
      { status: 500 }
    );
  }

  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
  const fileName = deadlineDocument.file_name || "document.pdf";
  const arrayBuffer = await fileData.arrayBuffer();

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Length": String(fileData.size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, must-revalidate",
  };

  if (shouldDownload) {
    headers["Content-Disposition"] = `attachment; ${encodeContentDispositionFileName(fileName)}`;
  } else {
    headers["Content-Disposition"] = "inline";
  }

  return new NextResponse(arrayBuffer, { headers });
}
