"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type EditDeadlineFormProps = {
  deadline: {
    id: number;
    title: string;
    category: string;
    due_date: string;
  };
};

export default function EditDeadlineForm({ deadline }: EditDeadlineFormProps) {

    const [title, setTitle] = useState(deadline.title);
    const [category, setCategory] = useState(deadline.category);
    const [dueDate, setDueDate] = useState(deadline.due_date);
    
    const router = useRouter();

const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  if (!title || !category || !dueDate) {
    alert("Merci de remplir tous les champs.");
    return;
  }

  await supabase
    .from("deadlines")
    .update({
      title,
      category,
      due_date: dueDate,
    })
    .eq("id", deadline.id);

  router.push("/deadlines");
  router.refresh();
};

return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium">
          Nom de l'échéance
        </label>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Catégorie
        </label>

        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none focus:border-blue-500"
        />
      </div>

                  <div>
        <label className="mb-2 block text-sm font-medium">
          Date d'échéance
        </label>

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none focus:border-blue-500"
        />
      </div>

      <button
        type="submit"
        className="rounded-xl bg-blue-500 px-6 py-3 font-semibold hover:bg-blue-400"
      >
        Enregistrer les modifications
      </button>

    </form>
  );
}