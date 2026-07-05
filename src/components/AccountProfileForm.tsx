"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AccountProfileFormProps = {
  initialFullName: string;
  email: string;
};

function normalizeFullName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export default function AccountProfileForm({
  initialFullName,
  email,
}: AccountProfileFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState(initialFullName);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    const normalizedFullName = normalizeFullName(fullName);

    if (normalizedFullName && normalizedFullName.length < 2) {
      setSuccessMessage("");
      setErrorMessage("Le nom affiché doit contenir au moins 2 caractères.");
      return;
    }

    setIsLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: normalizedFullName,
      },
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(
        "Impossible de mettre à jour le profil pour le moment. Réessayez dans quelques instants."
      );
      return;
    }

    setFullName(normalizedFullName);
    setSuccessMessage("Profil mis à jour.");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20"
    >
      <div className="border-b border-white/10 pb-5">
        <h2 className="text-2xl font-bold text-white">Profil utilisateur</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Gérez l’identité visible dans DuePilot. L’adresse e-mail reste votre
          identifiant de connexion.
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

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-100">
            Nom affiché
          </span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Ex : Julien"
            maxLength={80}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Ce nom sert uniquement à personnaliser l’espace connecté.
          </p>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-100">
            Adresse e-mail
          </span>
          <input
            type="email"
            value={email}
            disabled
            className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-slate-400 outline-none"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Le changement d’e-mail sera ajouté dans une version dédiée pour
            éviter les erreurs de sécurité en beta privée.
          </p>
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center rounded-2xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-blue-500/50"
        >
          {isLoading ? "Enregistrement..." : "Enregistrer le profil"}
        </button>
      </div>
    </form>
  );
}
