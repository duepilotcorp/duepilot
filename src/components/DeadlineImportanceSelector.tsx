"use client";

import {
  DEADLINE_IMPORTANCE_DESCRIPTIONS,
  DEADLINE_IMPORTANCE_LABELS,
  DEADLINE_IMPORTANCE_LEVELS,
  getDeadlineImportanceBadgeClassName,
  getDeadlineImportanceDotClassName,
  type DeadlineImportanceLevel,
} from "@/lib/deadline-importance";

type DeadlineImportanceSelectorProps = {
  value: DeadlineImportanceLevel;
  onChange: (value: DeadlineImportanceLevel) => void;
  disabled?: boolean;
  stepLabel?: string;
};

export default function DeadlineImportanceSelector({
  value,
  onChange,
  disabled = false,
  stepLabel = "Priorité métier",
}: DeadlineImportanceSelectorProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Niveau d’importance</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Distinguez la criticité métier de l’urgence calculée par la date.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
          {stepLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {DEADLINE_IMPORTANCE_LEVELS.map((level) => {
          const isSelected = value === level;

          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              disabled={disabled}
              className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? getDeadlineImportanceBadgeClassName(level)
                  : "border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                <span className={`h-2.5 w-2.5 rounded-full ${getDeadlineImportanceDotClassName(level)}`} />
                {DEADLINE_IMPORTANCE_LABELS[level]}
              </span>
              <span className="mt-2 block text-sm leading-6 opacity-80">
                {DEADLINE_IMPORTANCE_DESCRIPTIONS[level]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
