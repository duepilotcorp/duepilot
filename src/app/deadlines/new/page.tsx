"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function NewDeadlinePage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isLoading) {
      return;
    }

    if (!title || !category || !dueDate) {
      alert("Merci de remplir tous les champs.");
      return;
    }

    setIsLoading(true);

    await supabase.from("deadlines").insert({
      title,
      category,
      due_date: dueDate,
    });

    router.push("/deadlines");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-2xl">
        <a
          href="/deadlines"
          className="text-sm font-medium text-blue-300 hover:text-blue-200"
        >
          ← Retour aux échéances
        </a>

        <h1 className="mt-8 text-4xl font-bold">Nouvelle échéance</h1>

        <p className="mt-2 text-slate-400">
          Ajoutez une nouvelle échéance à surveiller.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Nom de l'échéance
            </label>

            <input
              type="text"
              placeholder="Ex : Assurance RC Pro"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Catégorie
            </label>

            <input
              type="text"
              placeholder="Ex : Assurance"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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
              disabled={isLoading}
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-blue-500 px-6 py-3 font-semibold hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Création en cours..." : "Créer l'échéance"}
          </button>
        </form>
      </div>
    </main>
  );
}