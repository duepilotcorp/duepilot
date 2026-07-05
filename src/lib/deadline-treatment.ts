export type DeadlineChecklistItem = {
  id: number;
  deadline_id: number;
  title: string;
  is_completed: boolean;
  position: number;
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EditableChecklistItem = {
  id?: number;
  title: string;
  is_completed?: boolean;
};

export const MAX_TREATMENT_NOTE_LENGTH = 1200;
export const MAX_USEFUL_LINK_LABEL_LENGTH = 80;
export const MAX_USEFUL_LINK_URL_LENGTH = 500;
export const MAX_CHECKLIST_ITEMS = 20;
export const MAX_CHECKLIST_ITEM_LENGTH = 160;

export function normalizeTreatmentNote(value: string | null | undefined) {
  return (value ?? "").trim().slice(0, MAX_TREATMENT_NOTE_LENGTH);
}

export function normalizeUsefulLinkLabel(value: string | null | undefined) {
  return (value ?? "").trim().slice(0, MAX_USEFUL_LINK_LABEL_LENGTH);
}

export function normalizeUsefulLinkUrl(value: string | null | undefined) {
  const trimmedValue = (value ?? "").trim().slice(0, MAX_USEFUL_LINK_URL_LENGTH);

  if (!trimmedValue) return "";

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}

export function isValidUsefulLinkUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeChecklistTitle(value: string | null | undefined) {
  return (value ?? "").trim().slice(0, MAX_CHECKLIST_ITEM_LENGTH);
}

export function normalizeChecklistItems<T extends { id?: number; title: string; is_completed?: boolean }>(
  items: T[]
) {
  return items
    .map((item) => ({
      ...item,
      title: normalizeChecklistTitle(item.title),
    }))
    .filter((item) => item.title.length > 0)
    .slice(0, MAX_CHECKLIST_ITEMS);
}

export function getChecklistCompletion(items: Pick<DeadlineChecklistItem, "is_completed">[]) {
  const total = items.length;

  if (total === 0) {
    return {
      total,
      completed: 0,
      percent: 0,
    };
  }

  const completed = items.filter((item) => item.is_completed).length;

  return {
    total,
    completed,
    percent: Math.round((completed / total) * 100),
  };
}
