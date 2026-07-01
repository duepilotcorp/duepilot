"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NewDeadlinePage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");
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

    const { error } = await supabase.from("deadlines").insert({
      title: title.trim(),
      category: category.trim(),
      due_date: dueDate,
      user_id: user.id,
    });

    if (error) {
      setErrorMessage(`Erreur Supabase : ${error.message}`);
      setIsLoading(false);
      return;
    }

    router.push("/deadlines");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/deadlines"
          className="text-sm font-medium text-blue-300 transition hover:text-blue-200"
        >
          ← Retour aux échéances
        </Link>

        <h1 className="mt-8 text-4xl font-bold">Nouvelle échéance</h1>

        <p className="mt-2 text-slate-400">
          Ajoutez une nouvelle échéance à surveiller.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-medium">
              Nom de l'échéance
            </label>

            <input
              id="title"
              type="text"
              placeholder="Ex : Assurance RC Pro"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="mb-2 block text-sm font-medium"
            >
              Catégorie
            </label>

            <input
              id="category"
              type="text"
              placeholder="Ex : Assurance"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
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
            {isLoading ? "Création en cours..." : "Créer l'échéance"}
          </button>
        </form>
      </div>
    </main>
  );
}
