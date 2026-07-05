import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getDeadlineDocumentsByDeadlineId } from "@/lib/deadline-documents-server";
import type { DeadlineDocument } from "@/lib/deadline-documents";
import {
  buildDeadlineAccessOrFilter,
  DEADLINE_VISIBILITY_LABELS,
  getDeadlineWorkflowLabel,
  getDeadlineVisibilityBadgeClassName,
  getDeadlineWorkflowBadgeClassName,
  normalizeDeadlineVisibility,
  normalizeDeadlineWorkflowStatus,
  type DeadlineVisibility,
  type DeadlineWorkflowStatus,
} from "@/lib/deadline-access";
import {
  getDeadlineImportanceBadgeClassName,
  getDeadlineImportanceDotClassName,
  getDeadlineImportanceLabel,
  normalizeDeadlineImportance,
  type DeadlineImportanceLevel,
} from "@/lib/deadline-importance";
import { ensureUserOrganization } from "@/lib/organizations";
import { getRecurrenceShortLabel } from "@/lib/recurrence";
import { getUserDisplayName } from "@/lib/user-display";
import { isUserAdmin } from "@/lib/user-roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Deadline = {
  id: number;
  title: string;
  category: string | null;
  due_date: string;
  recurrence_rule: string | null;
  importance_level: string | null;
  created_at: string;
  user_id: string | null;
  organization_id: string | null;
  visibility: string | null;
  workflow_status: string | null;
};

type CalendarDeadline = Deadline & {
  categoryLabel: string;
  daysUntilDeadline: number;
  formattedDate: string;
  compactDate: string;
  monthIndex: number;
  document: DeadlineDocument | null;
  visibility: DeadlineVisibility;
  workflowStatus: DeadlineWorkflowStatus;
  visibilityLabel: string;
  workflowLabel: string;
  visibilityClassName: string;
  workflowClassName: string;
  recurrenceLabel: string;
  importanceLevel: DeadlineImportanceLevel;
  importanceLabel: string;
  importanceClassName: string;
  importanceDotClassName: string;
};

type CalendarMonth = {
  value: string;
  label: string;
  shortLabel: string;
  monthIndex: number;
  deadlines: CalendarDeadline[];
  total: number;
  lateCount: number;
  next30Count: number;
  criticalCount: number;
  highCount: number;
  pendingValidationCount: number;
  missingDocumentsCount: number;
  teamCount: number;
  personalCount: number;
  riskLevel: "empty" | "calm" | "watch" | "busy" | "critical";
  riskLabel: string;
  riskClassName: string;
  accentClassName: string;
};

type SearchParams = Record<string, string | string[] | undefined>;
type ScopeFilter = "all" | "team" | "personal";
type RegistryFilter = "active" | "all" | "archived";
type ImportanceFilter = "all" | DeadlineImportanceLevel;

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;
const YEAR_OPTION_WINDOW = 10;

const MONTHS = [
  { value: "01", label: "Janvier", shortLabel: "Jan." },
  { value: "02", label: "Février", shortLabel: "Fév." },
  { value: "03", label: "Mars", shortLabel: "Mars" },
  { value: "04", label: "Avril", shortLabel: "Avr." },
  { value: "05", label: "Mai", shortLabel: "Mai" },
  { value: "06", label: "Juin", shortLabel: "Juin" },
  { value: "07", label: "Juillet", shortLabel: "Juil." },
  { value: "08", label: "Août", shortLabel: "Août" },
  { value: "09", label: "Septembre", shortLabel: "Sept." },
  { value: "10", label: "Octobre", shortLabel: "Oct." },
  { value: "11", label: "Novembre", shortLabel: "Nov." },
  { value: "12", label: "Décembre", shortLabel: "Déc." },
] as const;

const SCOPE_FILTERS: { value: ScopeFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "team", label: "Équipe" },
  { value: "personal", label: "Personnel" },
];

const REGISTRY_FILTERS: { value: RegistryFilter; label: string }[] = [
  { value: "active", label: "Actives uniquement" },
  { value: "all", label: "Actives + historique" },
  { value: "archived", label: "Historique seul" },
];

const IMPORTANCE_FILTERS: { value: ImportanceFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Important" },
  { value: "critical", label: "Très urgent" },
];

function getTodayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    const fallbackDate = new Date(date);
    fallbackDate.setHours(0, 0, 0, 0);
    return fallbackDate;
  }

  return new Date(year, month - 1, day);
}

function getDaysUntilDeadline(dueDate: string, today: Date) {
  const deadlineDate = parseLocalDate(dueDate);
  return Math.ceil((deadlineDate.getTime() - today.getTime()) / DAY_IN_MS);
}

function formatDeadlineDate(dueDate: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parseLocalDate(dueDate));
}

function formatCompactDate(dueDate: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  }).format(parseLocalDate(dueDate));
}

function getSearchParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getYearFilter(value: string, fallbackYear: number) {
  const parsedYear = Number(value.replace(/[^0-9]/g, "").slice(0, 4));

  if (!Number.isInteger(parsedYear) || parsedYear < MIN_YEAR || parsedYear > MAX_YEAR) {
    return fallbackYear;
  }

  return parsedYear;
}

function buildYearOptions(currentYear: number, selectedYear: number) {
  const startYear = Math.max(
    MIN_YEAR,
    Math.min(currentYear, selectedYear) - YEAR_OPTION_WINDOW
  );
  const endYear = Math.min(
    MAX_YEAR,
    Math.max(currentYear, selectedYear) + YEAR_OPTION_WINDOW
  );

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
}

function getScopeFilter(value: string): ScopeFilter {
  return SCOPE_FILTERS.some((filter) => filter.value === value)
    ? (value as ScopeFilter)
    : "all";
}

function getRegistryFilter(value: string): RegistryFilter {
  return REGISTRY_FILTERS.some((filter) => filter.value === value)
    ? (value as RegistryFilter)
    : "active";
}

function getImportanceFilter(value: string): ImportanceFilter {
  return IMPORTANCE_FILTERS.some((filter) => filter.value === value)
    ? (value as ImportanceFilter)
    : "all";
}

function getMonthFilter(value: string) {
  return MONTHS.some((month) => month.value === value) ? value : "";
}

function getReadableStatus(daysUntilDeadline: number, workflowStatus: DeadlineWorkflowStatus) {
  if (workflowStatus === "archived") return "Archivée";

  if (daysUntilDeadline < 0) {
    const daysLate = Math.abs(daysUntilDeadline);
    return `En retard de ${daysLate} jour${daysLate > 1 ? "s" : ""}`;
  }

  if (daysUntilDeadline === 0) return "À traiter aujourd’hui";
  if (daysUntilDeadline === 1) return "À traiter demain";
  return `Dans ${daysUntilDeadline} jours`;
}

function getDeadlineTimingClassName(daysUntilDeadline: number, workflowStatus: DeadlineWorkflowStatus) {
  if (workflowStatus === "archived") return "border-slate-400/25 bg-slate-400/10 text-slate-100";
  if (daysUntilDeadline < 0) return "border-red-400/25 bg-red-400/10 text-red-100";
  if (daysUntilDeadline <= 7) return "border-orange-400/25 bg-orange-400/10 text-orange-100";
  if (daysUntilDeadline <= 30) return "border-yellow-400/25 bg-yellow-400/10 text-yellow-100";
  return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
}

function matchesScopeFilter(deadline: CalendarDeadline, scope: ScopeFilter) {
  if (scope === "team") return deadline.visibility === "team";
  if (scope === "personal") return deadline.visibility === "personal";
  return true;
}

function matchesRegistryFilter(deadline: CalendarDeadline, registry: RegistryFilter) {
  if (registry === "archived") return deadline.workflowStatus === "archived";
  if (registry === "active") return deadline.workflowStatus !== "archived";
  return true;
}

function matchesImportanceFilter(deadline: CalendarDeadline, importance: ImportanceFilter) {
  if (importance === "all") return true;
  return deadline.importanceLevel === importance;
}

function getMonthRisk(month: Omit<CalendarMonth, "riskLevel" | "riskLabel" | "riskClassName" | "accentClassName">) {
  if (month.total === 0) {
    return {
      riskLevel: "empty" as const,
      riskLabel: "Libre",
      riskClassName: "border-white/10 bg-white/[0.03] text-slate-300",
      accentClassName: "bg-slate-500/40",
    };
  }

  if (month.lateCount > 0 || month.criticalCount > 0) {
    return {
      riskLevel: "critical" as const,
      riskLabel: "Critique",
      riskClassName: "border-red-400/25 bg-red-400/10 text-red-100",
      accentClassName: "bg-red-400 shadow-[0_0_26px_rgba(248,113,113,0.45)]",
    };
  }

  if (month.pendingValidationCount > 0 || month.next30Count > 0 || month.missingDocumentsCount >= 2) {
    return {
      riskLevel: "watch" as const,
      riskLabel: "À surveiller",
      riskClassName: "border-orange-400/25 bg-orange-400/10 text-orange-100",
      accentClassName: "bg-orange-300 shadow-[0_0_24px_rgba(253,186,116,0.4)]",
    };
  }

  if (month.total >= 5 || month.highCount >= 2) {
    return {
      riskLevel: "busy" as const,
      riskLabel: "Chargé",
      riskClassName: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
      accentClassName: "bg-yellow-300 shadow-[0_0_22px_rgba(253,224,71,0.35)]",
    };
  }

  return {
    riskLevel: "calm" as const,
    riskLabel: "Calme",
    riskClassName: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    accentClassName: "bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.35)]",
  };
}

function buildCalendarHref({
  year,
  scope,
  registry,
  importance,
  month,
}: {
  year: number;
  scope: ScopeFilter;
  registry: RegistryFilter;
  importance: ImportanceFilter;
  month?: string;
}) {
  const params = new URLSearchParams({ year: String(year) });

  if (scope !== "all") params.set("scope", scope);
  if (registry !== "active") params.set("registry", registry);
  if (importance !== "all") params.set("importance", importance);
  if (month) params.set("month", month);

  const queryString = params.toString();
  return `/deadlines/calendar${queryString ? `?${queryString}` : ""}`;
}

function getFilterSummary({
  year,
  scope,
  registry,
  importance,
  month,
}: {
  year: number;
  scope: ScopeFilter;
  registry: RegistryFilter;
  importance: ImportanceFilter;
  month: string;
}) {
  const activeFilters = [`Année ${year}`];

  if (scope !== "all") {
    activeFilters.push(
      SCOPE_FILTERS.find((filter) => filter.value === scope)?.label ?? "Portée filtrée"
    );
  }

  if (registry !== "active") {
    activeFilters.push(
      REGISTRY_FILTERS.find((filter) => filter.value === registry)?.label ?? "Registre filtré"
    );
  }

  if (importance !== "all") {
    activeFilters.push(
      IMPORTANCE_FILTERS.find((filter) => filter.value === importance)?.label ?? "Importance filtrée"
    );
  }

  if (month) {
    activeFilters.push(
      MONTHS.find((monthItem) => monthItem.value === month)?.label ?? `Mois ${month}`
    );
  }

  return activeFilters;
}

function sortCalendarDeadlines(deadlines: CalendarDeadline[]) {
  return [...deadlines].sort(
    (firstDeadline, secondDeadline) =>
      parseLocalDate(firstDeadline.due_date).getTime() -
      parseLocalDate(secondDeadline.due_date).getTime()
  );
}

export default async function ComplianceCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};
  const today = getTodayAtMidnight();
  const currentYear = today.getFullYear();
  const selectedYear = getYearFilter(getSearchParam(params, "year"), currentYear);
  const yearOptions = buildYearOptions(currentYear, selectedYear);
  const scopeFilter = getScopeFilter(getSearchParam(params, "scope"));
  const registryFilter = getRegistryFilter(getSearchParam(params, "registry"));
  const importanceFilter = getImportanceFilter(getSearchParam(params, "importance"));
  const selectedMonth = getMonthFilter(getSearchParam(params, "month"));

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const userOrganization = await ensureUserOrganization({
    userId: user.id,
    email: user.email,
  });
  const isAdminUser = await isUserAdmin(user.id);
  const displayName = getUserDisplayName(user);
  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear}-12-31`;

  const { data: deadlines, error } = await supabase
    .from("deadlines")
    .select("id, title, category, due_date, recurrence_rule, importance_level, created_at, user_id, organization_id, visibility, workflow_status")
    .or(
      buildDeadlineAccessOrFilter({
        userId: user.id,
        organizationId: userOrganization?.organization.id,
      })
    )
    .gte("due_date", yearStart)
    .lte("due_date", yearEnd)
    .order("due_date", { ascending: true })
    .returns<Deadline[]>();

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Impossible de charger le calendrier conformité pour le moment. Réessayez dans quelques instants.
          </p>
        </div>
      </main>
    );
  }

  const deadlineList = deadlines ?? [];
  const documentsByDeadlineId = await getDeadlineDocumentsByDeadlineId({
    supabase,
    userId: user.id,
    deadlineIds: deadlineList.map((deadline) => deadline.id),
  });

  const enrichedDeadlines: CalendarDeadline[] = deadlineList.map((deadline) => {
    const visibility = normalizeDeadlineVisibility(deadline.visibility);
    const workflowStatus = normalizeDeadlineWorkflowStatus(deadline.workflow_status);
    const importanceLevel = normalizeDeadlineImportance(deadline.importance_level);
    const deadlineDate = parseLocalDate(deadline.due_date);

    return {
      ...deadline,
      visibility,
      workflowStatus,
      visibilityLabel: DEADLINE_VISIBILITY_LABELS[visibility],
      workflowLabel: getDeadlineWorkflowLabel({ status: workflowStatus, visibility }),
      visibilityClassName: getDeadlineVisibilityBadgeClassName(visibility),
      workflowClassName: getDeadlineWorkflowBadgeClassName(workflowStatus),
      recurrenceLabel: getRecurrenceShortLabel(deadline.recurrence_rule),
      importanceLevel,
      importanceLabel: getDeadlineImportanceLabel(importanceLevel),
      importanceClassName: getDeadlineImportanceBadgeClassName(importanceLevel),
      importanceDotClassName: getDeadlineImportanceDotClassName(importanceLevel),
      categoryLabel: deadline.category?.trim() || "Sans catégorie",
      daysUntilDeadline: getDaysUntilDeadline(deadline.due_date, today),
      formattedDate: formatDeadlineDate(deadline.due_date),
      compactDate: formatCompactDate(deadline.due_date),
      monthIndex: deadlineDate.getMonth(),
      document: documentsByDeadlineId.get(deadline.id) ?? null,
    };
  });

  const filteredDeadlines = sortCalendarDeadlines(
    enrichedDeadlines.filter(
      (deadline) =>
        matchesScopeFilter(deadline, scopeFilter) &&
        matchesRegistryFilter(deadline, registryFilter) &&
        matchesImportanceFilter(deadline, importanceFilter)
    )
  );

  const months: CalendarMonth[] = MONTHS.map((month, index) => {
    const monthDeadlines = filteredDeadlines.filter(
      (deadline) => deadline.monthIndex === index
    );
    const baseMonth = {
      value: month.value,
      label: month.label,
      shortLabel: month.shortLabel,
      monthIndex: index,
      deadlines: monthDeadlines,
      total: monthDeadlines.length,
      lateCount: monthDeadlines.filter(
        (deadline) => deadline.workflowStatus !== "archived" && deadline.daysUntilDeadline < 0
      ).length,
      next30Count: monthDeadlines.filter(
        (deadline) =>
          deadline.workflowStatus !== "archived" &&
          deadline.daysUntilDeadline >= 0 &&
          deadline.daysUntilDeadline <= 30
      ).length,
      criticalCount: monthDeadlines.filter(
        (deadline) => deadline.importanceLevel === "critical"
      ).length,
      highCount: monthDeadlines.filter(
        (deadline) => deadline.importanceLevel === "high"
      ).length,
      pendingValidationCount: monthDeadlines.filter(
        (deadline) => deadline.workflowStatus === "completed"
      ).length,
      missingDocumentsCount: monthDeadlines.filter(
        (deadline) => !deadline.document && deadline.workflowStatus !== "archived"
      ).length,
      teamCount: monthDeadlines.filter((deadline) => deadline.visibility === "team").length,
      personalCount: monthDeadlines.filter((deadline) => deadline.visibility === "personal").length,
    };
    const risk = getMonthRisk(baseMonth);

    return {
      ...baseMonth,
      ...risk,
    };
  });

  const selectedMonthData = months.find((month) => month.value === selectedMonth) ?? null;
  const detailMonths = selectedMonthData
    ? [selectedMonthData]
    : months.filter((month) => month.total > 0);
  const busiestMonth = [...months].sort((a, b) => b.total - a.total)[0] ?? null;
  const criticalMonths = months.filter((month) => month.riskLevel === "critical");
  const watchMonths = months.filter((month) => month.riskLevel === "watch");
  const total = filteredDeadlines.length;
  const activeCount = filteredDeadlines.filter(
    (deadline) => deadline.workflowStatus !== "archived"
  ).length;
  const archivedCount = filteredDeadlines.filter(
    (deadline) => deadline.workflowStatus === "archived"
  ).length;
  const lateCount = filteredDeadlines.filter(
    (deadline) => deadline.workflowStatus !== "archived" && deadline.daysUntilDeadline < 0
  ).length;
  const criticalCount = filteredDeadlines.filter(
    (deadline) => deadline.importanceLevel === "critical"
  ).length;
  const pendingValidationCount = filteredDeadlines.filter(
    (deadline) => deadline.workflowStatus === "completed"
  ).length;
  const missingDocumentsCount = filteredDeadlines.filter(
    (deadline) => !deadline.document && deadline.workflowStatus !== "archived"
  ).length;
  const filterSummary = getFilterSummary({
    year: selectedYear,
    scope: scopeFilter,
    registry: registryFilter,
    importance: importanceFilter,
    month: selectedMonth,
  });
  const resetHref = `/deadlines/calendar?year=${currentYear}`;
  const previousYearHref = buildCalendarHref({
    year: selectedYear - 1,
    scope: scopeFilter,
    registry: registryFilter,
    importance: importanceFilter,
    month: selectedMonth,
  });
  const nextYearHref = buildCalendarHref({
    year: selectedYear + 1,
    scope: scopeFilter,
    registry: registryFilter,
    importance: importanceFilter,
    month: selectedMonth,
  });

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader
          subtitle="Calendrier conformité"
          userName={displayName}
          userEmail={user.email}
          organizationName={userOrganization?.organization.name}
          organizationRole={userOrganization?.membership.role}
          isAdminUser={isAdminUser}
          active="calendar"
        />

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-cyan-500/20 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                  Calendrier conformité
                </div>

                <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Votre année administrative en un coup d’œil.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Visualisez les pics de charge, les mois critiques et les échéances à anticiper sur {selectedYear}.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
                  {filterSummary.map((filter) => (
                    <span key={filter} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                      {filter}
                    </span>
                  ))}
                  <Link
                    href="/deadlines"
                    className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white"
                  >
                    Retour au registre actif
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 text-cyan-100">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                  Synthèse annuelle
                </p>
                <h2 className="mt-4 text-2xl font-bold text-white">
                  {criticalMonths.length > 0
                    ? `${criticalMonths.length} mois critique${criticalMonths.length > 1 ? "s" : ""} détecté${criticalMonths.length > 1 ? "s" : ""}`
                    : watchMonths.length > 0
                      ? `${watchMonths.length} mois à surveiller`
                      : "Planning sous contrôle"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-cyan-50/80">
                  {busiestMonth && busiestMonth.total > 0
                    ? `${busiestMonth.label} concentre le plus d’échéances avec ${busiestMonth.total} élément${busiestMonth.total > 1 ? "s" : ""}.`
                    : "Ajoutez vos échéances pour construire votre vision annuelle."}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-3">
                    <p className="text-cyan-100/70">Échéances</p>
                    <p className="mt-1 text-2xl font-bold text-white">{total}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-3">
                    <p className="text-cyan-100/70">Critiques</p>
                    <p className="mt-1 text-2xl font-bold text-white">{criticalCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Actives",
              value: activeCount,
              helper: `${archivedCount} en historique inclus`,
              className: "border-blue-500/20 bg-blue-500/10",
              valueClassName: "text-blue-100",
            },
            {
              label: "En retard",
              value: lateCount,
              helper: "À régulariser en priorité",
              className: "border-red-500/20 bg-red-500/10",
              valueClassName: "text-red-100",
            },
            {
              label: "À valider",
              value: pendingValidationCount,
              helper: "Workflow équipe",
              className: "border-emerald-500/20 bg-emerald-500/10",
              valueClassName: "text-emerald-100",
            },
            {
              label: "Docs manquants",
              value: missingDocumentsCount,
              helper: "Preuves à centraliser",
              className: "border-orange-500/20 bg-orange-500/10",
              valueClassName: "text-orange-100",
            },
          ].map((card) => (
            <div
              key={card.label}
              className={`rounded-3xl border p-5 shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:shadow-2xl ${card.className}`}
            >
              <p className="text-sm font-medium text-slate-300">{card.label}</p>
              <p className={`mt-4 text-5xl font-bold ${card.valueClassName}`}>{card.value}</p>
              <p className="mt-3 text-sm text-slate-400">{card.helper}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20 animate-rise-in-delay-1 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Filtres annuels</h2>
              <p className="mt-1 text-sm text-slate-400">
                Ajustez la vue sans modifier vos échéances. Les archives restent séparées par défaut.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={previousYearHref}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
              >
                ← {selectedYear - 1}
              </Link>
              <Link
                href={nextYearHref}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
              >
                {selectedYear + 1} →
              </Link>
            </div>
          </div>

          <form action="/deadlines/calendar" className="mt-5 grid gap-4 xl:grid-cols-[0.7fr_0.75fr_0.9fr_0.75fr_auto] xl:items-end">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Année</span>
              <select
                name="year"
                defaultValue={selectedYear}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Portée</span>
              <select
                name="scope"
                defaultValue={scopeFilter}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
              >
                {SCOPE_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Registre</span>
              <select
                name="registry"
                defaultValue={registryFilter}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
              >
                {REGISTRY_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Importance</span>
              <select
                name="importance"
                defaultValue={importanceFilter}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
              >
                {IMPORTANCE_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <button
                type="submit"
                className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
              >
                Appliquer
              </button>
              <Link
                href={resetHref}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-center text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
              >
                Reset
              </Link>
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20 animate-rise-in-delay-1 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">Vue annuelle</p>
              <h2 className="mt-2 text-2xl font-bold text-white">12 mois de conformité</h2>
            </div>
            <p className="text-sm text-slate-400">
              Cliquez sur un mois pour afficher son détail.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {months.map((month) => {
              const isSelected = selectedMonth === month.value;
              const monthHref = buildCalendarHref({
                year: selectedYear,
                scope: scopeFilter,
                registry: registryFilter,
                importance: importanceFilter,
                month: month.value,
              });

              return (
                <Link
                  key={month.value}
                  href={monthHref}
                  className={`group rounded-3xl border p-4 transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-cyan-400/10 ${
                    isSelected ? "border-cyan-300/45 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{month.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{selectedYear}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${month.riskClassName}`}>
                      {month.riskLabel}
                    </span>
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-4xl font-bold text-white">{month.total}</p>
                      <p className="mt-1 text-xs text-slate-500">échéance{month.total > 1 ? "s" : ""}</p>
                    </div>
                    <span className={`mb-2 h-3 w-3 rounded-full ${month.accentClassName}`} />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-2xl border border-red-400/15 bg-red-400/5 px-2 py-2 text-red-100">
                      <p className="font-bold">{month.lateCount}</p>
                      <p className="mt-0.5 text-red-100/60">retard</p>
                    </div>
                    <div className="rounded-2xl border border-orange-400/15 bg-orange-400/5 px-2 py-2 text-orange-100">
                      <p className="font-bold">{month.criticalCount}</p>
                      <p className="mt-0.5 text-orange-100/60">crit.</p>
                    </div>
                    <div className="rounded-2xl border border-blue-400/15 bg-blue-400/5 px-2 py-2 text-blue-100">
                      <p className="font-bold">{month.pendingValidationCount}</p>
                      <p className="mt-0.5 text-blue-100/60">valid.</p>
                    </div>
                  </div>

                  {month.deadlines.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {month.deadlines.slice(0, 3).map((deadline) => (
                        <div key={deadline.id} className="flex items-center gap-2 text-xs text-slate-300">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${deadline.importanceDotClassName}`} />
                          <span className="truncate">{deadline.title}</span>
                        </div>
                      ))}
                      {month.deadlines.length > 3 ? (
                        <p className="text-xs font-semibold text-cyan-100">
                          +{month.deadlines.length - 3} autre{month.deadlines.length - 3 > 1 ? "s" : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">Aucune échéance planifiée.</p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-slate-950/20 animate-rise-in-delay-1">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Détail mensuel</p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  {selectedMonthData ? selectedMonthData.label : "Tous les mois avec échéances"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedMonthData
                    ? `${selectedMonthData.total} échéance${selectedMonthData.total > 1 ? "s" : ""} sur ce mois.`
                    : "Sélectionnez un mois pour isoler son contenu."}
                </p>
              </div>
              {selectedMonth ? (
                <Link
                  href={buildCalendarHref({
                    year: selectedYear,
                    scope: scopeFilter,
                    registry: registryFilter,
                    importance: importanceFilter,
                  })}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                >
                  Voir tous les mois
                </Link>
              ) : null}
            </div>
          </div>

          {total === 0 ? (
            <div className="p-8 text-center sm:p-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <span className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_24px_rgba(103,232,249,0.6)]" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-white">Aucune échéance sur cette vue</h3>
              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                Changez l’année ou les filtres, ou ajoutez une échéance pour construire votre calendrier conformité.
              </p>
              <Link
                href="/deadlines/new"
                className="mt-7 inline-flex justify-center rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-400"
              >
                Ajouter une échéance
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {detailMonths.map((month) => (
                <div key={month.value} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white">{month.label} {selectedYear}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {month.total} échéance{month.total > 1 ? "s" : ""} · {month.teamCount} équipe · {month.personalCount} perso
                      </p>
                    </div>
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${month.riskClassName}`}>
                      {month.riskLabel}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {month.deadlines.map((deadline) => (
                      <article
                        key={deadline.id}
                        className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-white/[0.05]"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${deadline.importanceDotClassName}`} />
                              <Link
                                href={`/deadlines/${deadline.id}`}
                                className="truncate text-base font-semibold text-white transition hover:text-blue-100"
                              >
                                {deadline.title}
                              </Link>
                            </div>
                            <p className="mt-2 text-sm text-slate-400">
                              {deadline.categoryLabel} · {deadline.formattedDate} · {deadline.recurrenceLabel}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.visibilityClassName}`}>
                                {deadline.visibilityLabel}
                              </span>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.workflowClassName}`}>
                                {deadline.workflowLabel}
                              </span>
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.importanceClassName}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${deadline.importanceDotClassName}`} />
                                {deadline.importanceLabel}
                              </span>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getDeadlineTimingClassName(deadline.daysUntilDeadline, deadline.workflowStatus)}`}>
                                {getReadableStatus(deadline.daysUntilDeadline, deadline.workflowStatus)}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                            {deadline.document ? (
                              <Link
                                href={`/deadlines/documents/${deadline.document.id}`}
                                className="rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-sm font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white"
                              >
                                PDF
                              </Link>
                            ) : (
                              <span className="rounded-xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-sm font-semibold text-orange-100">
                                PDF manquant
                              </span>
                            )}
                            <Link
                              href={`/deadlines/${deadline.id}`}
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                            >
                              Voir
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
