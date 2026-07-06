import {
  DEFAULT_DEADLINE_CATEGORY_KEY,
  buildStoredDeadlineCategory,
  normalizeCustomCategoryLabel,
  normalizeDeadlineCategoryKey,
  type DeadlineCategoryKey,
} from "@/lib/deadline-categories";
import {
  normalizeDeadlineImportance,
  type DeadlineImportanceLevel,
} from "@/lib/deadline-importance";
import { normalizeRecurrenceRule, type RecurrenceRule } from "@/lib/recurrence";

export const DEADLINE_TEMPLATE_VISIBILITIES = ["personal", "organization"] as const;

export type DeadlineTemplateVisibility = (typeof DEADLINE_TEMPLATE_VISIBILITIES)[number];

export const DEADLINE_TEMPLATE_VISIBILITY_LABELS: Record<DeadlineTemplateVisibility, string> = {
  personal: "Personnel",
  organization: "Équipe",
};

export const DEADLINE_TEMPLATE_VISIBILITY_DESCRIPTIONS: Record<DeadlineTemplateVisibility, string> = {
  personal: "Visible uniquement par vous.",
  organization: "Visible par les membres actifs de l’entreprise.",
};

export type DeadlineTemplateChecklistItem = {
  title: string;
};

export type DeadlineTemplateLibraryItem = {
  id: number;
  organization_id: string | null;
  created_by: string;
  visibility: DeadlineTemplateVisibility;
  name: string;
  title: string;
  description: string | null;
  category: string;
  category_key: DeadlineCategoryKey;
  custom_category_label: string | null;
  notification_days: number[];
  recurrence_rule: RecurrenceRule;
  importance_level: DeadlineImportanceLevel;
  treatment_note: string | null;
  useful_link_url: string | null;
  useful_link_label: string | null;
  checklist_items: DeadlineTemplateChecklistItem[];
  created_at: string;
  updated_at: string | null;
};

export type DeadlineTemplateLibraryRow = {
  id: number;
  organization_id: string | null;
  created_by: string;
  visibility: string | null;
  name: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  category_key: string | null;
  custom_category_label: string | null;
  notification_days: number[] | null;
  recurrence_rule: string | null;
  importance_level: string | null;
  treatment_note: string | null;
  useful_link_url: string | null;
  useful_link_label: string | null;
  checklist_items: unknown;
  created_at: string;
  updated_at: string | null;
};

export type DeadlineTemplatePayload = {
  organization_id: string | null;
  created_by: string;
  visibility: DeadlineTemplateVisibility;
  name: string;
  title: string;
  description: string | null;
  category: string;
  category_key: DeadlineCategoryKey;
  custom_category_label: string | null;
  notification_days: number[];
  recurrence_rule: RecurrenceRule;
  importance_level: DeadlineImportanceLevel;
  treatment_note: string | null;
  useful_link_url: string | null;
  useful_link_label: string | null;
  checklist_items: DeadlineTemplateChecklistItem[];
};

const NOTIFICATION_DAY_ORDER = [30, 15, 7, 3, 1, 0];

function normalizeText(value?: string | null, maxLength = 120) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeLongText(value?: string | null, maxLength = 1200) {
  return (value ?? "").trim().replace(/\r\n/g, "\n").slice(0, maxLength);
}

export function normalizeDeadlineTemplateVisibility(
  value: string | null | undefined
): DeadlineTemplateVisibility {
  return value === "organization" ? "organization" : "personal";
}

export function normalizeDeadlineTemplateName(value?: string | null) {
  return normalizeText(value, 120);
}

export function normalizeDeadlineTemplateTitle(value?: string | null) {
  return normalizeText(value, 120);
}

export function normalizeDeadlineTemplateDescription(value?: string | null) {
  return normalizeLongText(value, 800);
}

export function normalizeDeadlineTemplateNotificationDays(days?: number[] | null) {
  const validDays = Array.from(
    new Set(
      (days ?? [])
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && NOTIFICATION_DAY_ORDER.includes(day))
    )
  );

  const normalizedDays = NOTIFICATION_DAY_ORDER.filter((day) => validDays.includes(day));
  return normalizedDays.length > 0 ? normalizedDays : [30, 7, 1];
}

export function normalizeDeadlineTemplateChecklistItems(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return { title: normalizeText(item, 160) };
      if (item && typeof item === "object" && "title" in item) {
        return { title: normalizeText(String((item as { title?: unknown }).title ?? ""), 160) };
      }
      return { title: "" };
    })
    .filter((item) => item.title.length > 0)
    .slice(0, 40);
}

export function normalizeDeadlineTemplateRow(
  row: DeadlineTemplateLibraryRow
): DeadlineTemplateLibraryItem {
  const categoryKey = normalizeDeadlineCategoryKey(row.category_key);
  const customCategoryLabel = normalizeCustomCategoryLabel(row.custom_category_label);
  const title = normalizeDeadlineTemplateTitle(row.title) || "Modèle sans nom";
  const name = normalizeDeadlineTemplateName(row.name) || title;

  return {
    id: Number(row.id),
    organization_id: row.organization_id,
    created_by: row.created_by,
    visibility: normalizeDeadlineTemplateVisibility(row.visibility),
    name,
    title,
    description: normalizeDeadlineTemplateDescription(row.description) || null,
    category:
      normalizeText(row.category, 100) ||
      buildStoredDeadlineCategory({
        categoryKey,
        customCategoryLabel,
      }),
    category_key: categoryKey,
    custom_category_label: customCategoryLabel || null,
    notification_days: normalizeDeadlineTemplateNotificationDays(row.notification_days),
    recurrence_rule: normalizeRecurrenceRule(row.recurrence_rule),
    importance_level: normalizeDeadlineImportance(row.importance_level),
    treatment_note: normalizeLongText(row.treatment_note, 1200) || null,
    useful_link_url: normalizeText(row.useful_link_url, 300) || null,
    useful_link_label: normalizeText(row.useful_link_label, 80) || null,
    checklist_items: normalizeDeadlineTemplateChecklistItems(row.checklist_items),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function normalizeDeadlineTemplateRows(rows?: DeadlineTemplateLibraryRow[] | null) {
  return (rows ?? []).map(normalizeDeadlineTemplateRow);
}

export function buildDeadlineTemplatePayload({
  userId,
  organizationId,
  canCreateOrganizationTemplate,
  visibility,
  name,
  title,
  description,
  categoryKey,
  customCategoryLabel,
  notificationDays,
  recurrenceRule,
  importanceLevel,
  treatmentNote,
  usefulLinkUrl,
  usefulLinkLabel,
  checklistItems,
}: {
  userId: string;
  organizationId?: string | null;
  canCreateOrganizationTemplate: boolean;
  visibility: DeadlineTemplateVisibility;
  name: string;
  title: string;
  description?: string | null;
  categoryKey?: string | null;
  customCategoryLabel?: string | null;
  notificationDays?: number[] | null;
  recurrenceRule?: string | null;
  importanceLevel?: string | null;
  treatmentNote?: string | null;
  usefulLinkUrl?: string | null;
  usefulLinkLabel?: string | null;
  checklistItems?: Array<{ title?: string | null }> | null;
}): DeadlineTemplatePayload {
  const safeVisibility =
    visibility === "organization" && canCreateOrganizationTemplate && organizationId
      ? "organization"
      : "personal";
  const safeCategoryKey = normalizeDeadlineCategoryKey(categoryKey ?? DEFAULT_DEADLINE_CATEGORY_KEY);
  const safeCustomCategoryLabel = normalizeCustomCategoryLabel(customCategoryLabel);
  const safeTitle = normalizeDeadlineTemplateTitle(title);
  const safeName = normalizeDeadlineTemplateName(name) || safeTitle;
  const safeChecklistItems = normalizeDeadlineTemplateChecklistItems(checklistItems ?? []);

  return {
    organization_id: safeVisibility === "organization" ? organizationId ?? null : null,
    created_by: userId,
    visibility: safeVisibility,
    name: safeName,
    title: safeTitle,
    description: normalizeDeadlineTemplateDescription(description) || null,
    category: buildStoredDeadlineCategory({
      categoryKey: safeCategoryKey,
      customCategoryLabel: safeCustomCategoryLabel,
    }),
    category_key: safeCategoryKey,
    custom_category_label: safeCustomCategoryLabel || null,
    notification_days: normalizeDeadlineTemplateNotificationDays(notificationDays),
    recurrence_rule: normalizeRecurrenceRule(recurrenceRule),
    importance_level: normalizeDeadlineImportance(importanceLevel),
    treatment_note: normalizeLongText(treatmentNote, 1200) || null,
    useful_link_url: normalizeText(usefulLinkUrl, 300) || null,
    useful_link_label: normalizeText(usefulLinkLabel, 80) || null,
    checklist_items: safeChecklistItems,
  };
}

export function getDeadlineTemplateReminderSummary(days: number[]) {
  const normalizedDays = normalizeDeadlineTemplateNotificationDays(days);

  return normalizedDays
    .map((day) => (day === 0 ? "Jour J" : `J-${day}`))
    .join(" · ");
}
