"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DeleteDeadlineButtonProps = {
  id: number;
};

export default function DeleteDeadlineButton({ id }: DeleteDeadlineButtonProps) {
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
      alert(`Erreur Supabase : ${error.message}`);
      setIsDeleting(false);
      return;
    }

    router.refresh();
    setIsDeleting(false);
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-500/50"
    >
      {isDeleting ? "Suppression..." : "Supprimer"}
    </button>
  );
}
