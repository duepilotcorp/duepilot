"use client";

import {
  RECURRENCE_DESCRIPTIONS,
  RECURRENCE_LABELS,
  RECURRENCE_RULES,
  getRecurrencePreview,
  type RecurrenceRule,
} from "@/lib/recurrence";

type RecurrenceSelectorProps = {
  value: RecurrenceRule;
  onChange: (value: RecurrenceRule) => void;
  disabled?: boolean;
  dueDate?: string;
  stepLabel?: string;
};

export default function RecurrenceSelector({
  value,
  onChange,
  disabled = false,
  dueDate = "",
  stepLabel = "Optionnel",
}: RecurrenceSelectorProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Récurrence</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
            Indiquez si cette échéance revient régulièrement. DuePilot proposera automatiquement la prochaine date au moment du renouvellement.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
          {stepLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {RECURRENCE_RULES.map((rule) => {
          const isSelected = value === rule;

          return (
            <button
              key={rule}
              type="button"
              onClick={() => onChange(rule)}
              disabled={disabled}
              className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-blue-400/40 bg-blue-400/10 text-blue-100"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <span className="block text-sm font-bold text-white">
                {RECURRENCE_LABELS[rule]}
              </span>
              <span className="mt-2 block text-xs leading-5 text-slate-400">
                {RECURRENCE_DESCRIPTIONS[rule]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Aperçu renouvellement
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-100">
          {getRecurrencePreview({ date: dueDate, recurrenceRule: value })}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Vous pourrez toujours modifier la date manuellement avant de clôturer une échéance.
        </p>
      </div>
    </section>
  );
}
