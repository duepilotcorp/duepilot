"use client";

import { useMemo, useRef } from "react";
import {
  addMonthsClamped,
  formatLongDate,
  getTodayInputValue,
  isBeforeInputDate,
} from "@/lib/date-utils";

type DateFieldQuickAction = {
  label: string;
  months: number;
};

type DateFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  hint?: string;
  accent?: "blue" | "emerald";
  quickActions?: DateFieldQuickAction[];
};

const DEFAULT_QUICK_ACTIONS: DateFieldQuickAction[] = [
  { label: "+1 mois", months: 1 },
  { label: "+3 mois", months: 3 },
  { label: "+6 mois", months: 6 },
  { label: "+1 an", months: 12 },
];

const accentClasses = {
  blue: {
    focus: "focus:border-blue-400 focus:ring-blue-500/10",
    button: "hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white",
    selected: "border-blue-400/25 bg-blue-400/10 text-blue-100",
  },
  emerald: {
    focus: "focus:border-emerald-300 focus:ring-emerald-500/10",
    button: "hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-white",
    selected: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  },
};

export default function DateField({
  id,
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  min,
  hint,
  accent = "blue",
  quickActions = DEFAULT_QUICK_ACTIONS,
}: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const todayInputValue = useMemo(() => getTodayInputValue(), []);
  const effectiveBaseDate = value || min || todayInputValue;
  const classes = accentClasses[accent];

  const openCalendar = () => {
    const input = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;

    if (!input || disabled) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
  };

  const applyQuickAction = (months: number) => {
    if (disabled) return;

    let nextDate = addMonthsClamped(effectiveBaseDate, months);

    if (min && isBeforeInputDate(nextDate, min)) {
      nextDate = min;
    }

    onChange(nextDate);
  };

  return (
    <div>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={id} className="block text-sm font-semibold text-slate-100">
          {label} {required ? <span className="text-blue-200">*</span> : null}
        </label>
        {value ? (
          <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${classes.selected}`}>
            {formatLongDate(value)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          required={required}
          className={`w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition ${classes.focus} focus:bg-slate-950 focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60`}
        />
        <button
          type="button"
          onClick={openCalendar}
          disabled={disabled}
          className={`inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition disabled:cursor-not-allowed disabled:opacity-60 ${classes.button}`}
        >
          Ouvrir le calendrier
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={`${action.label}-${action.months}`}
            type="button"
            onClick={() => applyQuickAction(action.months)}
            disabled={disabled}
            className={`rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-400 transition disabled:cursor-not-allowed disabled:opacity-60 ${classes.button}`}
          >
            {action.label}
          </button>
        ))}
      </div>

      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}
