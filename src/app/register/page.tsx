"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const benefits = [
  "Accès beta contrôlé",
  "Accompagnement sur les premières échéances",
  "Ouverture progressive aux entreprises pilotes",
];

const volumes = [
  "Moins de 10 échéances",
  "Entre 10 et 30 échéances",
  "Entre 30 et 100 échéances",
  "Plus de 100 échéances",
  "Je ne sais pas encore",
];

function getFriendlyRequestError(status: number, fallback: string) {
  if (status === 400) {
    return fallback || "Vérifiez les informations renseignées avant d’envoyer la demande.";
  }

  if (status === 500) {
    return "La demande n’a pas pu être envoyée pour le moment. Réessayez dans quelques instants.";
  }

  return fallback || "Impossible d’envoyer la demande pour le moment.";
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [deadlineVolume, setDeadlineVolume] = useState(volumes[1]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isLoading) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (!fullName.trim() || !email.trim() || !company.trim() || !role.trim()) {
      setErrorMessage("Complétez les champs obligatoires pour demander un accès beta.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/beta-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          company,
          role,
          deadlineVolume,
          message,
          website,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setErrorMessage(getFriendlyRequestError(response.status, result.error ?? ""));
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        "Demande envoyée. Nous reviendrons vers vous par email si votre entreprise correspond à la beta privée."
      );
      setFullName("");
      setEmail("");
      setCompany("");
      setRole("");
      setDeadlineVolume(volumes[1]);
      setMessage("");
      setWebsite("");
    } catch {
      setErrorMessage("Connexion impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_58%,#020617_100%)]" />

      <section className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <aside className="flex flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8 lg:order-2">
          <div>
            <Link href="/" className="inline-flex items-center gap-3 group">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/25 bg-blue-400/10">
                <span className="h-4 w-4 rounded-full bg-blue-300 shadow-[0_0_24px_rgba(147,197,253,0.8)]" />
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-[0.28em] text-blue-100">
                  DUEPILOT
                </span>
                <span className="block text-xs text-slate-400 transition group-hover:text-slate-300">
                  Retour à l’accueil
                </span>
              </span>
            </Link>

            <div className="mt-16 max-w-xl">
              <p className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100">
                Beta privée contrôlée
              </p>
              <h1 className="mt-7 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                Rejoindre DuePilot comme entreprise pilote.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-300">
                DuePilot ouvre progressivement ses accès aux entreprises qui
                veulent mieux anticiper leurs échéances administratives,
                réglementaires et contractuelles.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-3">
            {benefits.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/10 text-xs text-emerald-200">
                  ✓
                </span>
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="flex items-center justify-center py-10 lg:py-0">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="rounded-[1.55rem] border border-white/10 bg-slate-950/90 p-6 sm:p-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">
                  Demande d’accès
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                  Demander un accès beta
                </h2>
                <p className="mt-3 leading-7 text-slate-400">
                  L’inscription publique est temporairement fermée. Décrivez votre
                  entreprise et nous ouvrirons les accès progressivement aux bons
                  profils de test.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="website">Site web</label>
                  <input
                    id="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="fullName"
                      className="mb-2 block text-sm font-medium text-slate-200"
                    >
                      Nom complet
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      placeholder="Julien Martin"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      disabled={isLoading}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/70 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium text-slate-200"
                    >
                      Email professionnel
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="vous@entreprise.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      disabled={isLoading}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/70 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="company"
                      className="mb-2 block text-sm font-medium text-slate-200"
                    >
                      Entreprise
                    </label>
                    <input
                      id="company"
                      type="text"
                      placeholder="Nom de l’entreprise"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      autoComplete="organization"
                      disabled={isLoading}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/70 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="role"
                      className="mb-2 block text-sm font-medium text-slate-200"
                    >
                      Rôle
                    </label>
                    <input
                      id="role"
                      type="text"
                      placeholder="Dirigeant, RAF, office manager..."
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      autoComplete="organization-title"
                      disabled={isLoading}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/70 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="deadlineVolume"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Volume d’échéances à suivre
                  </label>
                  <select
                    id="deadlineVolume"
                    value={deadlineVolume}
                    onChange={(e) => setDeadlineVolume(e.target.value)}
                    disabled={isLoading}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition focus:border-blue-400/70 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {volumes.map((item) => (
                      <option key={item} value={item} className="bg-slate-950 text-white">
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Message optionnel
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    placeholder="Exemple : nous devons suivre nos assurances, certifications, contrôles réglementaires et contrats fournisseurs."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isLoading}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/70 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {errorMessage && (
                  <div className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-100">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">
                    {successMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-2xl bg-blue-500 px-6 py-4 text-sm font-semibold text-white shadow-2xl shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-400 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-blue-500/50 disabled:shadow-none"
                >
                  {isLoading ? "Envoi de la demande..." : "Demander un accès beta"}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center text-sm text-slate-400">
                Vous avez déjà un accès ?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-blue-200 transition hover:text-blue-100"
                >
                  Se connecter
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
