"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import NotificationDaysSelector, {
  DEFAULT_NOTIFICATION_DAYS,
  normalizeNotificationDays,
} from "@/components/NotificationDaysSelector";
import { createClient } from "@/lib/supabase/client";

export default function NewDeadlinePage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notificationDays, setNotificationDays] = useState<number[]>(
    DEFAULT_NOTIFICATION_DAYS
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isLoading) return;

    setErrorMessage("");

    if (!title.trim() || !category.trim() || !dueDate) {
      setErrorMessage("Merci de remplir tous les champs obligatoires.");
      return;
    }

    const selectedNotificationDays = normalizeNotificationDays(notificationDays);

    if (selectedNotificationDays.length === 0) {
      setErrorMessage("Sélectionnez au moins un rappel automatique.");
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
      notification_days: selectedNotificationDays,
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
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-white sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/deadlines"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        >
          <span aria-hidden="true">←</span>
          Retour aux échéances
        </Link>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.035] to-blue-500/[0.06] p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
          <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
            Nouvelle surveillance
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            Nouvelle échéance
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Centralisez une obligation importante et choisissez précisément les
            rappels que DuePilot devra envoyer avant la date critique.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
            <div className="grid gap-5">
              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-semibold text-slate-100"
                >
                  Nom de l’échéance
                </label>

                <input
                  id="title"
                  type="text"
                  placeholder="Ex : Assurance RC Pro"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="mb-2 block text-sm font-semibold text-slate-100"
                >
                  Catégorie
                </label>

                <input
                  id="category"
                  type="text"
                  placeholder="Ex : Assurance, Certification, Contrôle réglementaire"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="dueDate"
                  className="mb-2 block text-sm font-semibold text-slate-100"
                >
                  Date d’échéance
                </label>

                <input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition focus:border-blue-400 focus:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>
          </section>

          <NotificationDaysSelector
            selectedDays={notificationDays}
            onChange={setNotificationDays}
            disabled={isLoading}
          />

          {errorMessage && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/deadlines"
              className="inline-flex justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            >
              Annuler
            </Link>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex justify-center rounded-2xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
            >
              {isLoading ? "Création en cours..." : "Créer l’échéance"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
