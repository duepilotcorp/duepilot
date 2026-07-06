import { DEADLINE_CATEGORY_OPTIONS, getDeadlineCategoryLabel, normalizeDeadlineCategoryKey, type DeadlineCategoryKey } from "@/lib/deadline-categories";
import type { DeadlineVisibility, DeadlineWorkflowStatus } from "@/lib/deadline-access";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;
export type AuditScopeFilter = "all" | "team" | "personal";
export type AuditRegistryFilter = "active" | "active_archived" | "archived";

export type AuditFilters = {
  scope: AuditScopeFilter;
  registry: AuditRegistryFilter;
  categories: DeadlineCategoryKey[];
  year: string;
  dateFrom: string;
  dateTo: string;
  personId: string;
};

export type AuditFilterableDeadline = {
  due_date: string;
  categoryKey: string;
  visibility: DeadlineVisibility;
  workflowStatus: DeadlineWorkflowStatus;
  user_id: string | null;
  claimed_by: string | null;
  completed_by: string | null;
};

export type AuditPersonOption = {
  id: string;
  label: string;
  helper?: string;
};

const CATEGORY_KEYS = new Set<string>(DEADLINE_CATEGORY_OPTIONS.map((category) => category.key));
const UUIDISH_PATTERN = /^[a-zA-Z0-9-]{8,80}$/;

export const AUDIT_SCOPE_FILTERS: { value: AuditScopeFilter; label: string; helper: string }[] = [
  { value: "all", label: "Tout", helper: "Personnel + équipe" },
  { value: "team", label: "Équipe", helper: "Échéances partagées" },
  { value: "personal", label: "Personnel", helper: "Échéances privées" },
];

export const AUDIT_REGISTRY_FILTERS: { value: AuditRegistryFilter; label: string; helper: string }[] = [
  { value: "active", label: "Actives uniquement", helper: "En cours, ouvertes ou à valider" },
  { value: "active_archived", label: "Actives + traitées", helper: "Inclut l’historique selon les filtres" },
  { value: "archived", label: "Traitées uniquement", helper: "Échéances archivées / clôturées" },
];

function getRawParam(params: SearchParamsRecord, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getRawParamArray(params: SearchParamsRecord, key: string) {
  const value = params[key];
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean);
}

function getScopeFilter(value: string): AuditScopeFilter {
  if (value === "team" || value === "personal") return value;
  return "all";
}

function getRegistryFilter(value: string): AuditRegistryFilter {
  if (value === "active_archived" || value === "archived") return value;
  return "active";
}

function normalizeYear(value: string) {
  const year = value.replace(/[^0-9]/g, "").slice(0, 4);
  return year.length === 4 ? year : "";
}

function normalizeDate(value: string) {
  const normalizedValue = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) ? normalizedValue : "";
}

function normalizePersonId(value: string) {
  const normalizedValue = value.trim();
  return normalizedValue && UUIDISH_PATTERN.test(normalizedValue) ? normalizedValue : "all";
}

export function parseAuditFilters(params: SearchParamsRecord): AuditFilters {
  const categories = Array.from(
    new Set(
      getRawParamArray(params, "category")
        .filter((value) => CATEGORY_KEYS.has(value))
        .map((value) => normalizeDeadlineCategoryKey(value))
    )
  );

  return {
    scope: getScopeFilter(getRawParam(params, "scope")),
    registry: getRegistryFilter(getRawParam(params, "registry")),
    categories,
    year: normalizeYear(getRawParam(params, "year")),
    dateFrom: normalizeDate(getRawParam(params, "from")),
    dateTo: normalizeDate(getRawParam(params, "to")),
    personId: normalizePersonId(getRawParam(params, "person")),
  };
}

export function buildAuditQueryString(filters: AuditFilters) {
  const params = new URLSearchParams();

  if (filters.scope !== "all") params.set("scope", filters.scope);
  if (filters.registry !== "active") params.set("registry", filters.registry);
  if (filters.year) params.set("year", filters.year);
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  if (filters.personId !== "all") params.set("person", filters.personId);
  filters.categories.forEach((category) => params.append("category", category));

  return params.toString();
}

export function buildAuditHref(pathname: string, filters: AuditFilters) {
  const queryString = buildAuditQueryString(filters);
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function matchesAuditFilters(deadline: AuditFilterableDeadline, filters: AuditFilters) {
  if (filters.scope === "team" && deadline.visibility !== "team") return false;
  if (filters.scope === "personal" && deadline.visibility !== "personal") return false;

  if (filters.registry === "active" && deadline.workflowStatus === "archived") return false;
  if (filters.registry === "archived" && deadline.workflowStatus !== "archived") return false;

  if (filters.categories.length > 0 && !filters.categories.includes(normalizeDeadlineCategoryKey(deadline.categoryKey))) {
    return false;
  }

  if (filters.year && !deadline.due_date.startsWith(`${filters.year}-`)) return false;
  if (filters.dateFrom && deadline.due_date < filters.dateFrom) return false;
  if (filters.dateTo && deadline.due_date > filters.dateTo) return false;

  if (filters.personId !== "all") {
    const userIds = [deadline.user_id, deadline.claimed_by, deadline.completed_by].filter(Boolean);
    if (!userIds.includes(filters.personId)) return false;
  }

  return true;
}

export function getAuditFilterLabels(filters: AuditFilters, personLabel?: string | null) {
  const labels: string[] = [];

  const scopeLabel = AUDIT_SCOPE_FILTERS.find((filter) => filter.value === filters.scope)?.label;
  if (filters.scope !== "all" && scopeLabel) labels.push(`Portée : ${scopeLabel}`);

  const registryLabel = AUDIT_REGISTRY_FILTERS.find((filter) => filter.value === filters.registry)?.label;
  if (filters.registry !== "active" && registryLabel) labels.push(`Registre : ${registryLabel}`);

  if (filters.categories.length > 0) {
    labels.push(`Catégories : ${filters.categories.map((category) => getDeadlineCategoryLabel(category)).join(", ")}`);
  }

  if (filters.year) labels.push(`Année : ${filters.year}`);
  if (filters.dateFrom || filters.dateTo) {
    labels.push(`Dates : ${filters.dateFrom || "début"} → ${filters.dateTo || "fin"}`);
  }

  if (filters.personId !== "all") {
    labels.push(`Personne : ${personLabel || "Membre sélectionné"}`);
  }

  return labels;
}

export function getAvailableAuditYears(deadlines: Array<{ due_date: string }>) {
  const years = Array.from(
    new Set(
      deadlines
        .map((deadline) => deadline.due_date?.slice(0, 4))
        .filter((year): year is string => /^\d{4}$/.test(year))
    )
  ).sort((firstYear, secondYear) => Number(secondYear) - Number(firstYear));

  const currentYear = String(new Date().getFullYear());
  if (!years.includes(currentYear)) years.unshift(currentYear);

  return years;
}
