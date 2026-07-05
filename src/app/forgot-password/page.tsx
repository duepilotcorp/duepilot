"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    setSuccessMessage("");
    setErrorMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Renseignez l’adresse email liée à votre compte DuePilot.");
      return;
    }

    setIsLoading(true);

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    setIsLoading(false);

    if (error) {
      console.error("DuePilot password reset error", {
        message: error.message,
        name: error.name,
        status: "status" in error ? error.status : undefined,
        code: "code" in error ? error.code : undefined,
      });

      setErrorMessage(
        "Impossible d’envoyer le lien pour le moment. Vérifiez l’adresse email ou réessayez dans quelques instants."
      );
      return;
    }

    setSuccessMessage(
      "Si un compte DuePilot existe avec cette adresse, un lien de réinitialisation vient d’être envoyé."
    );
  };

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_58%,#020617_100%)]" />

      <section className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10 sm:px-8 lg:px-10">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="rounded-[1.55rem] border border-white/10 bg-slate-950/90 p-6 sm:p-8">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-blue-100">
              <span aria-hidden="true">←</span>
              Retour connexion
            </Link>

            <div className="mt-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">
                Mot de passe oublié
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                Recevoir un lien de réinitialisation
              </h1>
              <p className="mt-3 leading-7 text-slate-400">
                Entrez l’adresse email liée à votre compte DuePilot. Un lien sécurisé vous permettra de créer un nouveau mot de passe.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  Adresse email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  disabled={isLoading}
                  placeholder="vous@entreprise.com"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/70 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              {successMessage ? (
                <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">
                  {successMessage}
                </p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-100">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-2xl bg-blue-500 px-6 py-4 text-sm font-semibold text-white shadow-2xl shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-400 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-blue-500/50 disabled:shadow-none"
              >
                {isLoading ? "Envoi en cours..." : "Envoyer le lien sécurisé"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
