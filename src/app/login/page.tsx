"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-md">
        <a href="/" className="text-sm font-medium text-blue-300 hover:text-blue-200">
          ← Retour à l’accueil
        </a>

        <h1 className="mt-8 text-4xl font-bold">Connexion</h1>

        <p className="mt-2 text-slate-400">
          Connectez-vous à votre espace DuePilot.
        </p>

        <form className="mt-10 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Adresse email
            </label>

            <input
              type="email"
              placeholder="vous@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Mot de passe
            </label>

           <input
            type="password"
            placeholder="Votre mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none focus:border-blue-500"
          />
        </div>

          <button
  type="submit"
  className="w-full rounded-xl bg-blue-500 px-6 py-3 font-semibold hover:bg-blue-400"
>
  Se connecter
</button>
        </form>
      </div>
    </main>
  );
}