import { addMonthsClamped, formatLongDate } from "@/lib/date-utils";

export const RECURRENCE_RULES = [
  "none",
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
] as const;

export type RecurrenceRule = (typeof RECURRENCE_RULES)[number];

export const RECURRENCE_LABELS: Record<RecurrenceRule, string> = {
  none: "Aucune récurrence",
  monthly: "Tous les mois",
  quarterly: "Tous les 3 mois",
  semiannual: "Tous les 6 mois",
  yearly: "Tous les ans",
};

export const RECURRENCE_SHORT_LABELS: Record<RecurrenceRule, string> = {
  none: "Ponctuelle",
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  semiannual: "Semestrielle",
  yearly: "Annuelle",
};

export const RECURRENCE_DESCRIPTIONS: Record<RecurrenceRule, string> = {
  none: "DuePilot ne proposera pas automatiquement de prochaine date.",
  monthly: "Idéal pour les contrôles ou suivis mensuels.",
  quarterly: "Utile pour les vérifications trimestrielles.",
  semiannual: "Adapté aux revues semestrielles.",
  yearly: "Recommandé pour assurances, certifications et contrats annuels.",
};

const RECURRENCE_MONTHS: Record<Exclude<RecurrenceRule, "none">, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

export function normalizeRecurrenceRule(
  value: string | null | undefined
): RecurrenceRule {
  if (
    value === "monthly" ||
    value === "quarterly" ||
    value === "semiannual" ||
    value === "yearly"
  ) {
    return value;
  }

  return "none";
}

export function getNextRecurringDate(date: string, recurrenceRule: RecurrenceRule) {
  if (!date || recurrenceRule === "none") return "";

  return addMonthsClamped(date, RECURRENCE_MONTHS[recurrenceRule]);
}

export function getRecurrenceLabel(value: string | null | undefined) {
  return RECURRENCE_LABELS[normalizeRecurrenceRule(value)];
}

export function getRecurrenceShortLabel(value: string | null | undefined) {
  return RECURRENCE_SHORT_LABELS[normalizeRecurrenceRule(value)];
}

export function getRecurrencePreview({
  date,
  recurrenceRule,
}: {
  date: string;
  recurrenceRule: RecurrenceRule;
}) {
  const nextDate = getNextRecurringDate(date, recurrenceRule);

  if (!nextDate) return "Aucune prochaine date automatique";

  return `Prochaine date suggérée : ${formatLongDate(nextDate)}`;
}
