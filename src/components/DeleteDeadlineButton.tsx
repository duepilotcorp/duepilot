"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createActivityLog } from "@/lib/activity-logs";
import { DEADLINE_DOCUMENTS_BUCKET } from "@/lib/deadline-documents";
import { createClient } from "@/lib/supabase/client";

type DeleteDeadlineButtonProps = {
  id: number;
  title?: string;
  category?: string | null;
  documentFilePath?: string | null;
  documentFilePaths?: Array<string | null>;
  redirectTo?: string;
};

export default function DeleteDeadlineButton({
  id,
  title,
  category,
  documentFilePath,
  documentFilePaths = [],
  redirectTo,
}: DeleteDeadlineButtonProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;

    const confirmed = confirm("Voulez-vous vraiment supprimer cette échéance ?");

    if (!confirmed) return;

    setIsDeleting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      router.refresh();
      return;
    }

    const { data: documentRows } = await supabase
      .from("deadline_documents")
      .select("file_path")
      .eq("deadline_id", id);

    const databaseDocumentFilePaths = ((documentRows ?? []) as Array<{ file_path: string | null }>)
      .map((documentRow) => documentRow.file_path)
      .filter((filePath): filePath is string => Boolean(filePath));

    await createActivityLog({
      supabase,
      userId: user.id,
      deadlineId: id,
      action: "deadline.deleted",
      title: "Échéance supprimée",
      description: title
        ? `${title} a été supprimée du suivi DuePilot.`
        : "Une échéance a été supprimée du suivi DuePilot.",
      metadata: {
        title: title ?? null,
        category: category ?? null,
        had_document: Boolean(documentFilePath) || documentFilePaths.some(Boolean),
        document_count: databaseDocumentFilePaths.length || documentFilePaths.filter(Boolean).length || (documentFilePath ? 1 : 0),
      },
    });

    const { error } = await supabase
      .from("deadlines")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Impossible de supprimer cette échéance pour le moment.");
      setIsDeleting(false);
      return;
    }

    const filePathsToRemove = Array.from(
      new Set([documentFilePath, ...documentFilePaths, ...databaseDocumentFilePaths].filter((filePath): filePath is string => Boolean(filePath)))
    );

    if (filePathsToRemove.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(DEADLINE_DOCUMENTS_BUCKET)
        .remove(filePathsToRemove);

      if (storageError) {
        console.warn(storageError);
      }
    }

    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
      setIsDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:border-red-400/40 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isDeleting ? "Suppression..." : "Supprimer"}
    </button>
  );
}
