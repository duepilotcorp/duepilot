"use client";

type NotificationOption = {
  value: number;
  label: string;
  description: string;
};

type NotificationPreset = {
  label: string;
  description: string;
  days: number[];
};

type NotificationDaysSelectorProps = {
  selectedDays: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
  stepLabel?: string;
};

export const NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    value: 30,
    label: "J-30",
    description: "Préparer les documents en avance",
  },
  {
    value: 15,
    label: "J-15",
    description: "Relance intermédiaire",
  },
  {
    value: 7,
    label: "J-7",
    description: "Dernière semaine avant échéance",
  },
  {
    value: 3,
    label: "J-3",
    description: "Action rapide à prévoir",
  },
  {
    value: 1,
    label: "J-1",
    description: "Dernier rappel avant risque",
  },
  {
    value: 0,
    label: "Jour J",
    description: "Rappel le jour de l’échéance",
  },
];

const OPTION_ORDER = NOTIFICATION_OPTIONS.map((option) => option.value);

export const DEFAULT_NOTIFICATION_DAYS = [30, 7, 1];

const NOTIFICATION_PRESETS: NotificationPreset[] = [
  {
    label: "Standard",
    description: "J-30 · J-7 · J-1",
    days: DEFAULT_NOTIFICATION_DAYS,
  },
  {
    label: "Renforcé",
    description: "J-30 · J-15 · J-7 · J-3 · J-1 · Jour J",
    days: [30, 15, 7, 3, 1, 0],
  },
  {
    label: "Urgent",
    description: "J-7 · J-3 · J-1 · Jour J",
    days: [7, 3, 1, 0],
  },
];

export function normalizeNotificationDays(days: number[]) {
  const uniqueValidDays = Array.from(
    new Set(days.filter((day) => OPTION_ORDER.includes(day)))
  );

  return OPTION_ORDER.filter((day) => uniqueValidDays.includes(day));
}

function areSameDays(firstDays: number[], secondDays: number[]) {
  return (
    JSON.stringify(normalizeNotificationDays(firstDays)) ===
    JSON.stringify(normalizeNotificationDays(secondDays))
  );
}

function getSelectedSummary(days: number[]) {
  const normalizedDays = normalizeNotificationDays(days);

  if (normalizedDays.length === 0) {
    return "Aucun rappel sélectionné";
  }

  return normalizedDays
    .map((day) => {
      if (day === 0) return "Jour J";
      return `J-${day}`;
    })
    .join(" · ");
}

export default function NotificationDaysSelector({
  selectedDays,
  onChange,
  disabled = false,
  stepLabel = "Étape 2/2",
}: NotificationDaysSelectorProps) {
  const normalizedSelectedDays = normalizeNotificationDays(selectedDays);

  const toggleNotificationDay = (day: number) => {
    if (disabled) return;

    const nextDays = normalizedSelectedDays.includes(day)
      ? normalizedSelectedDays.filter((selectedDay) => selectedDay !== day)
      : [...normalizedSelectedDays, day];

    onChange(normalizeNotificationDays(nextDays));
  };

  const applyPreset = (days: number[]) => {
    if (disabled) return;

    onChange(normalizeNotificationDays(days));
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            Rappels automatiques
          </p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
            Choisissez quand DuePilot doit vous prévenir avant cette échéance.
            Les rappels sélectionnés seront utilisés par le cron quotidien.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="inline-flex w-fit rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">
            {normalizedSelectedDays.length} rappel
            {normalizedSelectedDays.length > 1 ? "s" : ""}
          </span>
          <span className="text-xs text-slate-500">{stepLabel}</span>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Profils rapides
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {NOTIFICATION_PRESETS.map((preset) => {
            const isSelected = areSameDays(normalizedSelectedDays, preset.days);

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.days)}
                disabled={disabled}
                className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelected
                    ? "border-blue-400/50 bg-blue-500/15 text-blue-100"
                    : "border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-sm font-bold">{preset.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NOTIFICATION_OPTIONS.map((option) => {
          const isSelected = normalizedSelectedDays.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleNotificationDay(option.value)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`group rounded-2xl border p-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-blue-400/50 bg-blue-500/15 shadow-lg shadow-blue-950/20"
                  : "border-white/10 bg-slate-950/40 hover:border-white/20 hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className={`text-sm font-bold ${
                      isSelected ? "text-blue-100" : "text-white"
                    }`}
                  >
                    {option.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {option.description}
                  </p>
                </div>

                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                    isSelected
                      ? "border-blue-300 bg-blue-400 text-slate-950"
                      : "border-white/20 text-transparent group-hover:border-white/40"
                  }`}
                >
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    fill="none"
                  >
                    <path
                      d="M5 10.5 8.2 13.5 15 6.5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Rappels sélectionnés
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-200">
          {getSelectedSummary(normalizedSelectedDays)}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Par défaut, DuePilot recommande J-30, J-7 et J-1 pour anticiper sans
          multiplier les notifications.
        </p>
      </div>
    </section>
  );
}
