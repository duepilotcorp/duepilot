"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import PasswordField from "@/components/PasswordField";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionMessage, setSessionMessage] = useState("Vérification du lien sécurisé...");
  const [sessionState, setSessionState] = useState<"checking" | "valid" | "error" | "idle">("checking");
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isWelcomeFlow, setIsWelcomeFlow] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const markValidSession = (message: string) => {
      window.history.replaceState({}, document.title, "/reset-password");
      setHasRecoverySession(true);
      setSessionState("valid");
      setSessionMessage(message);
    };

    const markInvalidSession = () => {
      setHasRecoverySession(false);
      setSessionState("error");
      setSessionMessage(
        "Lien de réinitialisation invalide ou expiré. Demandez un nouveau lien depuis la page de connexion."
      );
    };

    const hydrateRecoverySession = async () => {
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get("code");
      const welcome = currentUrl.searchParams.get("welcome") === "1";
      const searchErrorCode = currentUrl.searchParams.get("error_code");

      if (isMounted) {
        setIsWelcomeFlow(welcome);
      }
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashErrorCode = hashParams.get("error_code");
      const hasUrlResetError = Boolean(searchErrorCode || hashErrorCode);

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!isMounted) return;

        if (!error) {
          markValidSession(welcome ? "Lien sécurisé validé. Vous pouvez créer votre mot de passe." : "Lien sécurisé validé. Vous pouvez choisir un nouveau mot de passe.");
          return;
        }
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!isMounted) return;

        if (!error) {
          markValidSession(welcome ? "Lien sécurisé validé. Vous pouvez créer votre mot de passe." : "Lien sécurisé validé. Vous pouvez choisir un nouveau mot de passe.");
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (session) {
        markValidSession(
          welcome
            ? "Session sécurisée détectée. Vous pouvez créer votre mot de passe."
            : "Session sécurisée détectée. Vous pouvez choisir un nouveau mot de passe."
        );
        return;
      }

      if (hasUrlResetError) {
        markInvalidSession();
        return;
      }

      setHasRecoverySession(false);
      setSessionState("idle");
      setSessionMessage(
        welcome
          ? "Ouvrez cette page depuis le lien d’activation reçu par email pour créer votre compte."
          : "Ouvrez cette page depuis le lien reçu par email pour activer la réinitialisation."
      );
    };

    hydrateRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    setSuccessMessage("");
    setErrorMessage("");

    if (!hasRecoverySession) {
      setErrorMessage("Ouvrez le lien reçu par email avant de choisir un nouveau mot de passe.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);

    if (error) {
      setErrorMessage(
        "Impossible de modifier le mot de passe. Le lien est peut-être expiré : demandez un nouveau lien."
      );
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccessMessage(
      isWelcomeFlow
        ? "Mot de passe créé. Redirection vers votre espace DuePilot..."
        : "Mot de passe mis à jour. Redirection vers le dashboard..."
    );

    window.setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 900);
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
                {isWelcomeFlow ? "Création de compte" : "Nouveau mot de passe"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                {isWelcomeFlow ? "Créer votre accès DuePilot" : "Sécuriser votre accès DuePilot"}
              </h1>
              <p className="mt-3 leading-7 text-slate-400">
                {isWelcomeFlow
                  ? "Choisissez votre mot de passe pour activer votre compte beta DuePilot."
                  : "Choisissez un mot de passe robuste. Il remplacera immédiatement l’ancien mot de passe de votre compte."}
              </p>
            </div>

            <p
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                sessionState === "error"
                  ? "border-red-400/25 bg-red-400/10 text-red-100"
                  : sessionState === "valid"
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                    : "border-blue-400/20 bg-blue-400/10 text-blue-100"
              }`}
            >
              {sessionMessage}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <PasswordField
                id="resetPassword"
                label="Nouveau mot de passe"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                placeholder="Minimum 8 caractères"
                disabled={isLoading || !hasRecoverySession}
                showStrength
              />

              <PasswordField
                id="resetConfirmPassword"
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                placeholder="Répétez le même mot de passe"
                disabled={isLoading || !hasRecoverySession}
              />

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
                disabled={isLoading || !hasRecoverySession}
                className="w-full rounded-2xl bg-blue-500 px-6 py-4 text-sm font-semibold text-white shadow-2xl shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-400 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-blue-500/50 disabled:shadow-none"
              >
                {isLoading
                  ? isWelcomeFlow
                    ? "Création..."
                    : "Modification..."
                  : isWelcomeFlow
                    ? "Créer mon mot de passe"
                    : "Enregistrer le nouveau mot de passe"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
