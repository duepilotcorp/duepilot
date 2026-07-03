"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getSafeRedirectPath } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

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
      setErrorMessage("Veuillez renseigner votre email et votre mot de passe.");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage("Email ou mot de passe incorrect.");
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
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-sm font-medium text-blue-300 transition hover:text-blue-200"
        >
          ← Retour à l’accueil
        </Link>

        <h1 className="mt-8 text-4xl font-bold">Connexion</h1>

        <p className="mt-2 text-slate-400">
          Connectez-vous à votre espace DuePilot.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
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
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Mot de passe
            </label>

            <input
              id="password"
              type="password"
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="w-full rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
          >
            {isLoading ? "Connexion en cours..." : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="font-medium text-blue-300 transition hover:text-blue-200"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
