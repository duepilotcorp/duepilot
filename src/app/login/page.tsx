"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSafeRedirectPath } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";

const reassuranceItems = [
  "Accès sécurisé à votre espace",
  "Données isolées par utilisateur",
  "Rappels et échéances centralisés",
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get(
      "authError"
    );

    if (authError === "callback") {
      setErrorMessage(
        "Le lien de confirmation est invalide ou expiré. Essayez de vous connecter."
      );
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isLoading) return;

    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Renseignez votre email et votre mot de passe pour continuer.");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage("Les identifiants renseignés ne permettent pas de se connecter.");
      setIsLoading(false);
      return;
    }

    const redirectedFrom = new URLSearchParams(window.location.search).get(
      "redirectedFrom"
    );

    router.replace(getSafeRedirectPath(redirectedFrom));
    router.refresh();
  };

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_58%,#020617_100%)]" />

      <section className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
        <aside className="flex flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
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
              <p className="inline-flex rounded-full border border-blue-300/25 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-100">
                Espace beta privée
              </p>
              <h1 className="mt-7 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                Reprenez le contrôle sur vos échéances sensibles.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-300">
                Connectez-vous à votre cockpit DuePilot pour suivre vos
                obligations, anticiper les rappels et traiter les priorités.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-3">
            {reassuranceItems.map((item) => (
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
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="rounded-[1.55rem] border border-white/10 bg-slate-950/90 p-6 sm:p-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">
                  Connexion
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                  Accéder à DuePilot
                </h2>
                <p className="mt-3 leading-7 text-slate-400">
                  Entrez vos identifiants pour rejoindre votre tableau de bord.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Adresse email
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

                <div>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-200"
                    >
                      Mot de passe
                    </label>
                    <span className="text-xs text-slate-500">Accès sécurisé</span>
                  </div>
                  <input
                    id="password"
                    type="password"
                    placeholder="Votre mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/70 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {errorMessage && (
                  <div className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-100">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-2xl bg-blue-500 px-6 py-4 text-sm font-semibold text-white shadow-2xl shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-400 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-blue-500/50 disabled:shadow-none"
                >
                  {isLoading ? "Connexion en cours..." : "Se connecter"}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center text-sm text-slate-400">
                Pas encore d’accès ?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-blue-200 transition hover:text-blue-100"
                >
                  Demander un accès beta
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
