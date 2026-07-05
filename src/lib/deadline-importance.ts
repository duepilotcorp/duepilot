export const DEADLINE_IMPORTANCE_LEVELS = ["normal", "high", "critical"] as const;

export type DeadlineImportanceLevel = (typeof DEADLINE_IMPORTANCE_LEVELS)[number];

export const DEADLINE_IMPORTANCE_LABELS: Record<DeadlineImportanceLevel, string> = {
  normal: "Normal",
  high: "Important",
  critical: "Très urgent",
};

export const DEADLINE_IMPORTANCE_DESCRIPTIONS: Record<DeadlineImportanceLevel, string> = {
  normal: "Suivi standard, sans criticité métier particulière.",
  high: "Échéance importante à prioriser dans l’organisation.",
  critical: "Échéance très urgente, à rendre immédiatement visible.",
};

export function normalizeDeadlineImportance(
  value: string | null | undefined
): DeadlineImportanceLevel {
  if (value === "high" || value === "critical") return value;
  return "normal";
}

export function getDeadlineImportanceLabel(value: string | null | undefined) {
  return DEADLINE_IMPORTANCE_LABELS[normalizeDeadlineImportance(value)];
}

export function getDeadlineImportanceDescription(value: string | null | undefined) {
  return DEADLINE_IMPORTANCE_DESCRIPTIONS[normalizeDeadlineImportance(value)];
}

export function getDeadlineImportanceBadgeClassName(
  value: string | null | undefined
) {
  const importance = normalizeDeadlineImportance(value);

  if (importance === "critical") {
    return "border-red-400/30 bg-red-400/10 text-red-100";
  }

  if (importance === "high") {
    return "border-orange-400/30 bg-orange-400/10 text-orange-100";
  }

  return "border-slate-400/20 bg-slate-400/10 text-slate-200";
}

export function getDeadlineImportanceDotClassName(
  value: string | null | undefined
) {
  const importance = normalizeDeadlineImportance(value);

  if (importance === "critical") return "bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.65)]";
  if (importance === "high") return "bg-orange-300 shadow-[0_0_18px_rgba(253,186,116,0.55)]";
  return "bg-slate-400";
}
