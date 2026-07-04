"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEADLINE_DOCUMENTS_BUCKET } from "@/lib/deadline-documents";
import { createClient } from "@/lib/supabase/client";

type DeleteDeadlineButtonProps = {
  id: number;
  documentFilePath?: string | null;
  redirectTo?: string;
};

export default function DeleteDeadlineButton({
  id,
  documentFilePath,
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

    const { error } = await supabase
      .from("deadlines")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      alert("Impossible de supprimer cette échéance pour le moment.");
      setIsDeleting(false);
      return;
    }

    if (documentFilePath) {
      const { error: storageError } = await supabase.storage
        .from(DEADLINE_DOCUMENTS_BUCKET)
        .remove([documentFilePath]);

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
