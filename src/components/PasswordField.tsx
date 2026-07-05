"use client";

import { useMemo, useState } from "react";

type PasswordStrength = {
  score: number;
  label: string;
  helper: string;
  barClassName: string;
  textClassName: string;
};

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  minLength?: number;
  showStrength?: boolean;
};

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: "Non renseigné",
      helper: "Utilisez au moins 8 caractères avec des lettres, chiffres et symboles.",
      barClassName: "bg-slate-700",
      textClassName: "text-slate-500",
    };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return {
      score: Math.max(1, score),
      label: "Faible",
      helper: "Ajoutez de la longueur, une majuscule, un chiffre et un symbole.",
      barClassName: "bg-red-400",
      textClassName: "text-red-100",
    };
  }

  if (score <= 4) {
    return {
      score,
      label: "Correct",
      helper: "Bon début. Un mot de passe plus long reste recommandé.",
      barClassName: "bg-yellow-300",
      textClassName: "text-yellow-100",
    };
  }

  return {
    score,
    label: "Robuste",
    helper: "Mot de passe solide pour un usage professionnel.",
    barClassName: "bg-emerald-300",
    textClassName: "text-emerald-100",
  };
}

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = "Votre mot de passe",
  autoComplete = "current-password",
  disabled = false,
  minLength = 8,
  showStrength = false,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const strength = useMemo(() => getPasswordStrength(value), [value]);
  const widthClassName = ["w-0", "w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"][strength.score];

  return (
    <div>
      {label ? (
        <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-100">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={minLength}
          autoComplete={autoComplete}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/60 py-4 pl-4 pr-24 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {isVisible ? "Masquer" : "Afficher"}
        </button>
      </div>

      {showStrength ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold">
            <span className="text-slate-400">Robustesse</span>
            <span className={strength.textClassName}>{strength.label}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className={`h-full rounded-full transition-all ${widthClassName} ${strength.barClassName}`} />
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{strength.helper}</p>
        </div>
      ) : null}
    </div>
  );
}
