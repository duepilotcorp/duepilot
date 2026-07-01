"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Deadline = {
  id: number;
  title: string;
  category: string;
  due_date: string;
  created_at?: string;
  user_id?: string | null;
};

type EditDeadlineFormProps = {
  deadline: Deadline;
};

export default function EditDeadlineForm({ deadline }: EditDeadlineFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(deadline.title);
  const [category, setCategory] = useState(deadline.category);
  const [dueDate, setDueDate] = useState(deadline.due_date);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isLoading) return;

    setErrorMessage("");

    if (!title.trim() || !category.trim() || !dueDate) {
      setErrorMessage("Merci de remplir tous les champs.");
      return;
    }

    setIsLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      router.refresh();
      return;
    }

    const { error } = await supabase
      .from("deadlines")
      .update({
        title: title.trim(),
        category: category.trim(),
        due_date: dueDate,
      })
      .eq("id", deadline.id)
      .eq("user_id", user.id);

    if (error) {
      setErrorMessage(`Erreur Supabase : ${error.message}`);
      setIsLoading(false);
      return;
    }

    router.push("/deadlines");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-6">
      <div>
        <label htmlFor="title" className="mb-2 block text-sm font-medium">
          Nom de l'échéance
        </label>

        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor="category" className="mb-2 block text-sm font-medium">
          Catégorie
        </label>

        <input
          id="category"
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isLoading}
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor="dueDate" className="mb-2 block text-sm font-medium">
          Date d'échéance
        </label>

        <input
          id="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={isLoading}
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
      >
        {isLoading ? "Enregistrement..." : "Enregistrer les modifications"}
      </button>
    </form>
  );
}
