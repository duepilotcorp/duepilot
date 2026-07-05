"use client";

import { FormEvent, useState } from "react";
import PasswordField from "@/components/PasswordField";
import { createClient } from "@/lib/supabase/client";

export default function AccountPasswordForm() {
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    setSuccessMessage("");
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(
        "Impossible de modifier le mot de passe. Reconnectez-vous puis réessayez si la session a expiré."
      );
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccessMessage("Mot de passe mis à jour.");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20"
    >
      <div className="border-b border-white/10 pb-5">
        <h2 className="text-2xl font-bold text-white">Sécurité</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Changez votre mot de passe depuis votre session connectée. Utilisez un
          mot de passe unique, long et difficile à deviner.
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
        <PasswordField
          id="newPassword"
          label="Nouveau mot de passe"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="Minimum 8 caractères"
          disabled={isLoading}
          showStrength
        />

        <PasswordField
          id="confirmPassword"
          label="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Répétez le même mot de passe"
          disabled={isLoading}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center rounded-2xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-blue-500/50"
        >
          {isLoading ? "Modification..." : "Modifier le mot de passe"}
        </button>
      </div>
    </form>
  );
}
