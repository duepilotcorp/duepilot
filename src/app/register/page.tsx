"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const benefits = [
  "Dashboard de pilotage",
  "Échéances et rappels configurables",
  "Données isolées et accès sécurisé",
];

function getPasswordStrength(password: string) {
  if (!password) {
    return {
      label: "Minimum 6 caractères",
      className: "bg-slate-700",
      widthClassName: "w-0",
    };
  }

  if (password.length < 6) {
    return {
      label: "Trop court",
      className: "bg-red-400",
      widthClassName: "w-1/3",
    };
  }

  if (password.length < 10) {
    return {
      label: "Correct",
      className: "bg-yellow-300",
      widthClassName: "w-2/3",
    };
  }

  return {
    label: "Solide",
    className: "bg-emerald-300",
    widthClassName: "w-full",
  };
}

function getFriendlySignUpError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("already") || normalizedMessage.includes("registered")) {
    return "Un compte existe peut-être déjà avec cette adresse email. Essayez de vous connecter.";
  }

  if (normalizedMessage.includes("password")) {
    return "Le mot de passe ne respecte pas les règles demandées.";
  }

  if (normalizedMessage.includes("email")) {
    return "L’adresse email renseignée ne semble pas valide.";
  }

  return "Impossible de créer le compte pour le moment. Réessayez dans quelques instants.";
}

export default function RegisterPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isLoading) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Renseignez votre email et choisissez un mot de passe.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      setErrorMessage(getFriendlySignUpError(error.message));
      setIsLoading(false);
      return;
    }

    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setSuccessMessage(
      "Compte créé. Vérifiez votre boîte mail pour confirmer votre inscription."
    );
    setIsLoading(false);
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
                Création d’espace
              </p>
              <h1 className="mt-7 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                Construisez votre cockpit administratif en quelques minutes.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-300">
                Ajoutez vos premières échéances, configurez vos rappels et
                obtenez une vision immédiate des priorités de votre entreprise.
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
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="rounded-[1.55rem] border border-white/10 bg-slate-950/90 p-6 sm:p-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">
                  Inscription
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                  Créer votre espace
                </h2>
                <p className="mt-3 leading-7 text-slate-400">
                  Accédez à DuePilot et commencez à centraliser vos échéances
                  administratives sensibles.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Adresse email professionnelle
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
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/70 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${passwordStrength.widthClassName} ${passwordStrength.className}`}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Sécurité du mot de passe : {passwordStrength.label}
                    </p>
                  </div>
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
                  {isLoading ? "Création en cours..." : "Créer mon compte"}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center text-sm text-slate-400">
                Déjà un compte ?{" "}
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
