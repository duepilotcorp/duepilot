"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AccountEmailPreferencesFormProps = {
  initialWeeklySummaryEnabled: boolean;
};

export default function AccountEmailPreferencesForm({
  initialWeeklySummaryEnabled,
}: AccountEmailPreferencesFormProps) {
  const supabase = createClient();

  const [weeklySummaryEnabled, setWeeklySummaryEnabled] = useState(
    initialWeeklySummaryEnabled
  );
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    setIsLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsLoading(false);
      setErrorMessage("Votre session a expiré. Reconnectez-vous puis réessayez.");
      return;
    }

    const { error } = await supabase
      .from("user_notification_preferences")
      .upsert(
        {
          user_id: user.id,
          weekly_summary_enabled: weeklySummaryEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    setIsLoading(false);

    if (error) {
      setErrorMessage(
        "Impossible d’enregistrer vos préférences e-mail pour le moment. Réessayez dans quelques instants."
      );
      return;
    }

    setSuccessMessage(
      weeklySummaryEnabled
        ? "Résumé hebdomadaire activé."
        : "Résumé hebdomadaire désactivé."
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20"
    >
      <div className="border-b border-white/10 pb-5">
        <h2 className="text-2xl font-bold text-white">Préférences e-mail</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Choisissez les emails DuePilot que vous souhaitez recevoir. Le résumé
          hebdomadaire reste désactivé tant que vous ne l’activez pas vous-même.
        </p>
      </div>

      {successMessage ? (
        <p className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-100">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
        <label className="flex cursor-pointer flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <span className="min-w-0">
            <span className="block text-base font-bold text-white">
              Résumé hebdomadaire DuePilot
            </span>
            <span className="mt-2 block text-sm leading-6 text-slate-400">
              Recevoir une synthèse chaque semaine avec les échéances en retard,
              les échéances proches et les validations d’équipe en attente.
            </span>
            <span className="mt-3 block rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-xs leading-5 text-blue-100/85">
              Vous pourrez désactiver ce résumé à tout moment depuis cette page.
              Une mention de désactivation est aussi ajoutée dans chaque email.
            </span>
          </span>

          <span className="inline-flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100">
            <input
              type="checkbox"
              checked={weeklySummaryEnabled}
              onChange={(event) => setWeeklySummaryEnabled(event.target.checked)}
              disabled={isLoading}
              className="h-5 w-5 rounded border-white/20 bg-slate-950 text-blue-500 focus:ring-blue-500/30"
            />
            {weeklySummaryEnabled ? "Activé" : "Désactivé"}
          </span>
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex w-full justify-center rounded-2xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-blue-500/50 sm:w-auto"
        >
          {isLoading ? "Enregistrement..." : "Enregistrer les préférences"}
        </button>
      </div>
    </form>
  );
}
