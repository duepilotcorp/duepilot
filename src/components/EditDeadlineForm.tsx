"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import NotificationDaysSelector, {
  DEFAULT_NOTIFICATION_DAYS,
  normalizeNotificationDays,
} from "@/components/NotificationDaysSelector";
import { createClient } from "@/lib/supabase/client";

type Deadline = {
  id: number;
  title: string;
  category: string;
  due_date: string;
  notification_days?: number[] | null;
  created_at?: string;
  user_id?: string | null;
};

type EditDeadlineFormProps = {
  deadline: Deadline;
};

export default function EditDeadlineForm({ deadline }: EditDeadlineFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const initialNotificationDays = useMemo(() => {
    const normalizedDays = normalizeNotificationDays(
      deadline.notification_days ?? []
    );

    return normalizedDays.length > 0
      ? normalizedDays
      : DEFAULT_NOTIFICATION_DAYS;
  }, [deadline.notification_days]);

  const [title, setTitle] = useState(deadline.title);
  const [category, setCategory] = useState(deadline.category);
  const [dueDate, setDueDate] = useState(deadline.due_date);
  const [notificationDays, setNotificationDays] = useState<number[]>(
    initialNotificationDays
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

    const { error } = await supabase
      .from("deadlines")
      .update({
        title: title.trim(),
        category: category.trim(),
        due_date: dueDate,
        notification_days: selectedNotificationDays,
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
          {isLoading ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
