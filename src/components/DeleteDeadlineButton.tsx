"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type DeleteDeadlineButtonProps = {
  id: number;
};

export default function DeleteDeadlineButton({
  id,
}: DeleteDeadlineButtonProps) {
  const router = useRouter();

  const handleDelete = async () => {
  const confirmed = confirm("Voulez-vous vraiment supprimer cette échéance ?");

  if (!confirmed) {
    return;
  }

  await supabase.from("deadlines").delete().eq("id", id);

  router.refresh();
};

  return (
    <button
  onClick={handleDelete}
  className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-400"
>
      Supprimer
    </button>
  );
}