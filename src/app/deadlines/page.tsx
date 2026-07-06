import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import DeadlineOnboardingEmptyState from "@/components/DeadlineOnboardingEmptyState";
import DeleteDeadlineButton from "@/components/DeleteDeadlineButton";
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
import { ensureUserOrganization } from "@/lib/organizations";
import { getRecurrenceShortLabel } from "@/lib/recurrence";
import {
  getDeadlineImportanceBadgeClassName,
  getDeadlineImportanceDotClassName,
  getDeadlineImportanceLabel,
  normalizeDeadlineImportance,
  type DeadlineImportanceLevel,
} from "@/lib/deadline-importance";
import { isUserAdmin } from "@/lib/user-roles";
import { getUserDisplayName } from "@/lib/user-display";
import {
  DEADLINE_CATEGORY_OPTIONS,
  getDeadlineCategoryDisplay,
  getDeadlineCategoryLabel,
  getDeadlineMainCategoryKey,
} from "@/lib/deadline-categories";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Deadline = {
  id: number;
  title: string;
  category: string | null;
  category_key?: string | null;
  custom_category_label?: string | null;
  due_date: string;
  recurrence_rule: string | null;
  importance_level: string | null;
  created_at: string;
  user_id: string | null;
  organization_id: string | null;
  visibility: string | null;
  workflow_status: string | null;
  claimed_by: string | null;
  completed_by: string | null;
};

type EnrichedDeadline = Deadline & {
  categoryLabel: string;
  categoryKey: string;
  daysUntilDeadline: number;
  formattedDate: string;
  readableStatus: string;
  compactStatus: string;
  statusClassName: string;
  indicatorClassName: string;
  priorityLabel: string;
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

type SearchParams = Record<string, string | string[] | undefined>;

type StatusFilter = "all" | "late" | "today" | "next7" | "next30" | "safe";
type ScopeFilter = "all" | "team" | "personal" | "in_progress" | "completed";
type SortOption = "due_asc" | "due_desc" | "title_asc" | "created_desc";

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const SCOPE_FILTERS: { value: ScopeFilter; label: string }[] = [
  { value: "all", label: "Actives" },
  { value: "team", label: "Équipe" },
  { value: "personal", label: "Personnel" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "À valider" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tous les statuts" },
  { value: "late", label: "En retard" },
  { value: "today", label: "Aujourd’hui" },
  { value: "next7", label: "Sous 7 jours" },
  { value: "next30", label: "Sous 30 jours" },
  { value: "safe", label: "Sous contrôle" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "due_asc", label: "Date la plus proche" },
  { value: "due_desc", label: "Date la plus lointaine" },
  { value: "title_asc", label: "Nom A-Z" },
  { value: "created_desc", label: "Ajout récent" },
];

const MONTH_FILTERS = [
  { value: "", label: "Tous les mois" },
  { value: "01", label: "Janvier" },
  { value: "02", label: "Février" },
  { value: "03", label: "Mars" },
  { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },
  { value: "08", label: "Août" },
  { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
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

function getReadableStatus(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) {
    const daysLate = Math.abs(daysUntilDeadline);
    return `En retard de ${daysLate} jour${daysLate > 1 ? "s" : ""}`;
  }

  if (daysUntilDeadline === 0) {
    return "À traiter aujourd’hui";
  }

  if (daysUntilDeadline === 1) {
    return "À traiter demain";
  }

  return `Dans ${daysUntilDeadline} jours`;
}

function getCompactStatus(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) {
    return `J+${Math.abs(daysUntilDeadline)}`;
  }

  if (daysUntilDeadline === 0) {
    return "Jour J";
  }

  return `J-${daysUntilDeadline}`;
}

function getStatusClassName(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) {
    return "border-red-500/25 bg-red-500/10 text-red-100";
  }

  if (daysUntilDeadline <= 7) {
    return "border-orange-500/25 bg-orange-500/10 text-orange-100";
  }

  if (daysUntilDeadline <= 30) {
    return "border-yellow-500/25 bg-yellow-500/10 text-yellow-100";
  }

  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-100";
}

function getIndicatorClassName(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) return "bg-red-400";
  if (daysUntilDeadline <= 7) return "bg-orange-400";
  if (daysUntilDeadline <= 30) return "bg-yellow-300";
  return "bg-emerald-400";
}

function getPriorityLabel(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) return "Action immédiate";
  if (daysUntilDeadline === 0) return "À faire aujourd’hui";
  if (daysUntilDeadline <= 7) return "Très proche";
  if (daysUntilDeadline <= 30) return "À anticiper";
  return "Sous contrôle";
}

function getDeadlineInsight({
  total,
  lateCount,
  next7Count,
  next30Count,
}: {
  total: number;
  lateCount: number;
  next7Count: number;
  next30Count: number;
}) {
  if (total === 0) {
    return {
      label: "À configurer",
      title: "Votre registre d’échéances est prêt.",
      description:
        "Ajoutez vos premières obligations pour transformer DuePilot en cockpit de suivi administratif.",
      className: "border-blue-400/20 bg-blue-400/10 text-blue-100",
    };
  }

  if (lateCount > 0) {
    return {
      label: "Risque élevé",
      title: "Des échéances sont en retard.",
      description:
        "Traitez-les en priorité pour limiter les risques de non-conformité, de pénalité ou d’interruption d’activité.",
      className: "border-red-400/20 bg-red-400/10 text-red-100",
    };
  }

  if (next7Count > 0) {
    return {
      label: "Attention requise",
      title: "Certaines dates arrivent très vite.",
      description:
        "Votre suivi est en place, mais les prochains jours demandent une attention particulière.",
      className: "border-orange-400/20 bg-orange-400/10 text-orange-100",
    };
  }

  if (next30Count > 0) {
    return {
      label: "Planifié",
      title: "Le mois à venir est identifié.",
      description:
        "Vos prochaines obligations sont visibles suffisamment tôt pour être préparées sans urgence.",
      className: "border-yellow-400/20 bg-yellow-400/10 text-yellow-100",
    };
  }

  return {
    label: "Sous contrôle",
    title: "Aucune échéance critique à court terme.",
    description:
      "Votre planning administratif est sain. Continuez à centraliser vos obligations pour garder une vision complète.",
    className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  };
}

function getSearchParam(params: SearchParams, key: string) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getScopeFilter(value: string): ScopeFilter {
  return SCOPE_FILTERS.some((filter) => filter.value === value)
    ? (value as ScopeFilter)
    : "all";
}

function getStatusFilter(value: string): StatusFilter {
  return STATUS_FILTERS.some((filter) => filter.value === value)
    ? (value as StatusFilter)
    : "all";
}

function getSortOption(value: string): SortOption {
  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as SortOption)
    : "due_asc";
}

function matchesScopeFilter(deadline: EnrichedDeadline, scope: ScopeFilter) {
  if (scope === "team") return deadline.visibility === "team";
  if (scope === "personal") return deadline.visibility === "personal";
  if (scope === "in_progress") return deadline.workflowStatus === "in_progress";
  if (scope === "completed") return deadline.workflowStatus === "completed";
  return true;
}

function matchesStatusFilter(deadline: EnrichedDeadline, status: StatusFilter) {
  if (status === "late") return deadline.daysUntilDeadline < 0;
  if (status === "today") return deadline.daysUntilDeadline === 0;
  if (status === "next7") {
    return deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 7;
  }
  if (status === "next30") {
    return deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 30;
  }
  if (status === "safe") return deadline.daysUntilDeadline > 30;

  return true;
}

function sortDeadlines(deadlines: EnrichedDeadline[], sort: SortOption) {
  return [...deadlines].sort((firstDeadline, secondDeadline) => {
    if (sort === "due_desc") {
      return (
        parseLocalDate(secondDeadline.due_date).getTime() -
        parseLocalDate(firstDeadline.due_date).getTime()
      );
    }

    if (sort === "title_asc") {
      return firstDeadline.title.localeCompare(secondDeadline.title, "fr", {
        sensitivity: "base",
      });
    }

    if (sort === "created_desc") {
      return (
        new Date(secondDeadline.created_at).getTime() -
        new Date(firstDeadline.created_at).getTime()
      );
    }

    return (
      parseLocalDate(firstDeadline.due_date).getTime() -
      parseLocalDate(secondDeadline.due_date).getTime()
    );
  });
}

function buildFilterSummary({
  searchQuery,
  statusFilter,
  scopeFilter,
  categoryFilter,
  yearFilter,
  monthFilter,
}: {
  searchQuery: string;
  statusFilter: StatusFilter;
  scopeFilter: ScopeFilter;
  categoryFilter: string;
  yearFilter: string;
  monthFilter: string;
}) {
  const activeFilters: string[] = [];

  if (searchQuery) activeFilters.push(`Recherche : “${searchQuery}”`);
  if (scopeFilter !== "all") {
    activeFilters.push(
      SCOPE_FILTERS.find((filter) => filter.value === scopeFilter)?.label ??
        "Portée filtrée"
    );
  }
  if (statusFilter !== "all") {
    activeFilters.push(
      STATUS_FILTERS.find((filter) => filter.value === statusFilter)?.label ??
        "Statut filtré"
    );
  }
  if (categoryFilter !== "all") activeFilters.push(getDeadlineCategoryLabel(categoryFilter));
  if (yearFilter) activeFilters.push(`Année : ${yearFilter}`);
  if (monthFilter) {
    activeFilters.push(
      MONTH_FILTERS.find((month) => month.value === monthFilter)?.label ??
        `Mois : ${monthFilter}`
    );
  }

  return activeFilters;
}

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};

  const rawSearchQuery = getSearchParam(params, "q");
  const searchQuery = rawSearchQuery.trim().slice(0, 80);
  const normalizedSearchQuery = searchQuery.toLocaleLowerCase("fr-FR");
  const scopeFilter = getScopeFilter(getSearchParam(params, "scope"));
  const statusFilter = getStatusFilter(getSearchParam(params, "status"));
  const categoryFilter = getSearchParam(params, "category") || "all";
  const yearFilter = getSearchParam(params, "year").replace(/[^0-9]/g, "").slice(0, 4);
  const monthFilter = MONTH_FILTERS.some((month) => month.value === getSearchParam(params, "month"))
    ? getSearchParam(params, "month")
    : "";
  const sortOption = getSortOption(getSearchParam(params, "sort"));

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
  const canManageTeam =
    userOrganization?.membership.role === "owner" ||
    userOrganization?.membership.role === "admin";
  const isAdminUser = await isUserAdmin(user.id);
  const displayName = getUserDisplayName(user);

  const { data: deadlines, error } = await supabase
    .from("deadlines")
    .select("id, title, category, category_key, custom_category_label, due_date, recurrence_rule, importance_level, created_at, user_id, organization_id, visibility, workflow_status, claimed_by, completed_by")
    .or(
      buildDeadlineAccessOrFilter({
        userId: user.id,
        organizationId: userOrganization?.organization.id,
      })
    )
    .order("due_date", { ascending: true })
    .returns<Deadline[]>();

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Impossible de charger vos échéances pour le moment. Réessayez dans
            quelques instants.
          </p>
        </div>
      </main>
    );
  }

  const today = getTodayAtMidnight();
  const deadlineList = deadlines ?? [];
  const documentsByDeadlineId = await getDeadlineDocumentsByDeadlineId({
    supabase,
    userId: user.id,
    deadlineIds: deadlineList.map((deadline) => deadline.id),
  });

  const enrichedDeadlines: EnrichedDeadline[] = deadlineList.map((deadline) => {
    const daysUntilDeadline = getDaysUntilDeadline(deadline.due_date, today);
    const categoryLabel = getDeadlineCategoryDisplay({
        category: deadline.category,
        categoryKey: deadline.category_key,
        customCategoryLabel: deadline.custom_category_label,
      });
    const visibility = normalizeDeadlineVisibility(deadline.visibility);
    const workflowStatus = normalizeDeadlineWorkflowStatus(deadline.workflow_status);
    const importanceLevel = normalizeDeadlineImportance(deadline.importance_level);

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
      categoryLabel,
      categoryKey: getDeadlineMainCategoryKey({ category: deadline.category, categoryKey: deadline.category_key }),
      daysUntilDeadline,
      formattedDate: formatDeadlineDate(deadline.due_date),
      readableStatus: getReadableStatus(daysUntilDeadline),
      compactStatus: getCompactStatus(daysUntilDeadline),
      statusClassName: getStatusClassName(daysUntilDeadline),
      indicatorClassName: getIndicatorClassName(daysUntilDeadline),
      priorityLabel: getPriorityLabel(daysUntilDeadline),
      document: documentsByDeadlineId.get(deadline.id) ?? null,
    };
  });

  const activeDeadlines = enrichedDeadlines.filter(
    (deadline) => deadline.workflowStatus !== "archived"
  );
  const archivedDeadlines = enrichedDeadlines.filter(
    (deadline) => deadline.workflowStatus === "archived"
  );
  const total = activeDeadlines.length;
  const lateCount = activeDeadlines.filter(
    (deadline) => deadline.daysUntilDeadline < 0
  ).length;
  const todayCount = activeDeadlines.filter(
    (deadline) => deadline.daysUntilDeadline === 0
  ).length;
  const next7Count = activeDeadlines.filter(
    (deadline) =>
      deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 7
  ).length;
  const next30Count = activeDeadlines.filter(
    (deadline) =>
      deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 30
  ).length;
  const safeCount = activeDeadlines.filter(
    (deadline) => deadline.daysUntilDeadline > 30
  ).length;

  const usedCategoryKeys = new Set(activeDeadlines.map((deadline) => deadline.categoryKey));
  const categories = DEADLINE_CATEGORY_OPTIONS.filter((category) =>
    usedCategoryKeys.has(category.key)
  );

  const safeCategoryFilter = categories.some((category) => category.key === categoryFilter)
    ? categoryFilter
    : "all";

  const filteredDeadlines = sortDeadlines(
    activeDeadlines.filter((deadline) => {
      const searchableContent = [
        deadline.title,
        deadline.categoryLabel,
        deadline.formattedDate,
        deadline.readableStatus,
        deadline.priorityLabel,
        deadline.recurrenceLabel,
        deadline.importanceLabel,
        deadline.document?.file_name ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("fr-FR");

      const matchesSearch = normalizedSearchQuery
        ? searchableContent.includes(normalizedSearchQuery)
        : true;
      const matchesCategory =
        safeCategoryFilter === "all" || deadline.categoryKey === safeCategoryFilter;
      const deadlineDate = parseLocalDate(deadline.due_date);
      const matchesYear = yearFilter
        ? String(deadlineDate.getFullYear()) === yearFilter
        : true;
      const matchesMonth = monthFilter
        ? String(deadlineDate.getMonth() + 1).padStart(2, "0") === monthFilter
        : true;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesYear &&
        matchesMonth &&
        matchesScopeFilter(deadline, scopeFilter) &&
        matchesStatusFilter(deadline, statusFilter)
      );
    }),
    sortOption
  );

  const nextDeadline = activeDeadlines[0];
  const urgentDeadlines = activeDeadlines.filter(
    (deadline) => deadline.daysUntilDeadline <= 30
  );
  const insight = getDeadlineInsight({
    total,
    lateCount,
    next7Count,
    next30Count,
  });

  const categoryCount = categories.length;
  const documentCount = activeDeadlines.filter((deadline) => deadline.document).length;
  const teamCount = activeDeadlines.filter((deadline) => deadline.visibility === "team").length;
  const personalCount = activeDeadlines.filter((deadline) => deadline.visibility === "personal").length;
  const inProgressCount = activeDeadlines.filter((deadline) => deadline.workflowStatus === "in_progress").length;
  const completedCount = activeDeadlines.filter((deadline) => deadline.workflowStatus === "completed").length;
  const archivedCount = archivedDeadlines.length;
  const filteredCount = filteredDeadlines.length;
  const activeFilters = buildFilterSummary({
    searchQuery,
    statusFilter,
    scopeFilter,
    categoryFilter: safeCategoryFilter,
    yearFilter,
    monthFilter,
  });
  const hasActiveFilters = activeFilters.length > 0 || sortOption !== "due_asc";
  const filterFormKey = [
    searchQuery,
    scopeFilter,
    statusFilter,
    safeCategoryFilter,
    yearFilter,
    monthFilter,
    sortOption,
  ].join("|");
  const exportParams = new URLSearchParams();

  if (searchQuery) exportParams.set("q", searchQuery);
  if (scopeFilter !== "all") exportParams.set("scope", scopeFilter);
  if (statusFilter !== "all") exportParams.set("status", statusFilter);
  if (safeCategoryFilter !== "all") exportParams.set("category", safeCategoryFilter);
  if (yearFilter) exportParams.set("year", yearFilter);
  if (monthFilter) exportParams.set("month", monthFilter);
  if (sortOption !== "due_asc") exportParams.set("sort", sortOption);

  const exportQueryString = exportParams.toString();
  const csvExportHref = `/api/deadlines/export${
    exportQueryString ? `?${exportQueryString}` : ""
  }`;

  const statCards = [
    {
      label: "En retard",
      value: lateCount,
      helper: "À régulariser",
      href: "/deadlines?status=late",
      className: "border-red-500/20 bg-red-500/10 hover:border-red-400/40",
      valueClassName: "text-red-100",
    },
    {
      label: "Aujourd’hui",
      value: todayCount,
      helper: "Actions du jour",
      href: "/deadlines?status=today",
      className: "border-orange-500/20 bg-orange-500/10 hover:border-orange-400/40",
      valueClassName: "text-orange-100",
    },
    {
      label: "Sous 30 jours",
      value: next30Count,
      helper: "À anticiper",
      href: "/deadlines?status=next30",
      className: "border-yellow-500/20 bg-yellow-500/10 hover:border-yellow-400/40",
      valueClassName: "text-yellow-100",
    },
    {
      label: "Sous contrôle",
      value: safeCount,
      helper: "Au-delà de 30 jours",
      href: "/deadlines?status=safe",
      className: "border-emerald-500/20 bg-emerald-500/10 hover:border-emerald-400/40",
      valueClassName: "text-emerald-100",
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader
          subtitle="Registre des échéances"
          userName={displayName}
          userEmail={user.email}
          organizationName={userOrganization?.organization.name}
          organizationRole={userOrganization?.membership.role}
          isAdminUser={isAdminUser}
          active="deadlines"
          exportHref={csvExportHref}
        />

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
Échéances
                </div>

                <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Votre registre opérationnel.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  {lateCount > 0
                    ? `${lateCount} échéance${lateCount > 1 ? "s" : ""} en retard à régulariser.`
                    : next7Count > 0
                      ? `${next7Count} échéance${next7Count > 1 ? "s" : ""} à traiter sous 7 jours.`
                      : "Aucune échéance critique immédiate."}
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {total} échéance{total > 1 ? "s" : ""} suivie{total > 1 ? "s" : ""}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {categoryCount} catégorie{categoryCount > 1 ? "s" : ""}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {teamCount} équipe · {personalCount} perso
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {activeDeadlines.filter((deadline) => deadline.recurrence_rule && deadline.recurrence_rule !== "none").length} récurrente{activeDeadlines.filter((deadline) => deadline.recurrence_rule && deadline.recurrence_rule !== "none").length > 1 ? "s" : ""}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {inProgressCount} en cours · {completedCount} à valider
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {documentCount} document{documentCount > 1 ? "s" : ""}
                  </span>
                  <Link
                    href="/deadlines/calendar"
                    className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:text-white"
                  >
                    Calendrier conformité
                  </Link>
                  <Link
                    href="/deadlines/history"
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                  >
                    {archivedCount} en historique
                  </Link>
                </div>
              </div>

              <div className={`rounded-3xl border p-5 ${insight.className}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                  {insight.label}
                </p>
                <h2 className="mt-4 text-2xl font-bold text-white">
                  {insight.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-200/80">
                  {lateCount > 0
                    ? "Commencez par les éléments en retard, puis les échéances à 7 jours."
                    : "Utilisez les filtres pour isoler les priorités, documents et catégories sensibles."}
                </p>

                {nextDeadline ? (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                      Prochaine date
                    </p>
                    <p className="mt-2 font-semibold text-white">
                      {nextDeadline.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {nextDeadline.formattedDate} · {nextDeadline.readableStatus}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`group rounded-3xl border p-5 shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:shadow-2xl ${card.className}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-300">{card.label}</p>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-400 transition group-hover:border-white/20 group-hover:text-white">
                  Filtrer
                </span>
              </div>
              <p className={`mt-4 text-5xl font-bold ${card.valueClassName}`}>
                {card.value}
              </p>
              <p className="mt-3 text-sm text-slate-400">{card.helper}</p>
            </Link>
          ))}
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-slate-950/20 animate-rise-in-delay-1">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Liste des échéances
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {filteredCount} résultat{filteredCount > 1 ? "s" : ""} affiché{filteredCount > 1 ? "s" : ""} sur {total}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-300">
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-red-100">
                  {lateCount} en retard
                </span>
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-orange-100">
                  {next7Count} sous 7 jours
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                  {safeCount} stables
                </span>
              </div>
            </div>
          </div>

          {total === 0 ? (
            <DeadlineOnboardingEmptyState embedded variant="deadlines" />
          ) : (
            <>
              <details key={filterFormKey} className="border-b border-white/10 bg-slate-950/20 group">
                <summary className="flex cursor-pointer list-none flex-col gap-3 p-5 transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:p-6 [&::-webkit-details-marker]:hidden">
                  <div>
                    <p className="text-sm font-bold text-white">Filtres et tri</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {hasActiveFilters
                        ? `${activeFilters.length + (sortOption !== "due_asc" ? 1 : 0)} réglage${activeFilters.length + (sortOption !== "due_asc" ? 1 : 0) > 1 ? "s" : ""} actif${activeFilters.length + (sortOption !== "due_asc" ? 1 : 0) > 1 ? "s" : ""}`
                        : "Ouvrir pour rechercher, trier ou filtrer le registre."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
                    {activeFilters.length > 0 ? (
                      activeFilters.slice(0, 3).map((filter) => (
                        <span key={filter} className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-blue-100">
                          {filter}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                        Aucun filtre
                      </span>
                    )}
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 transition group-open:rotate-180">
                      ⌄
                    </span>
                  </div>
                </summary>

                <form
                  action="/deadlines"
                  className="border-t border-white/10 p-5 sm:p-6"
                >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="block min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Recherche
                    </span>
                    <input
                      type="search"
                      name="q"
                      defaultValue={searchQuery}
                      placeholder="Nom, catégorie, statut…"
                      className="mt-2 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:bg-white/[0.07]"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Portée
                    </span>
                    <select
                      name="scope"
                      defaultValue={scopeFilter}
                      className="mt-2 w-full min-w-0 truncate rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-10 text-sm text-white outline-none transition focus:border-blue-400/50"
                    >
                      {SCOPE_FILTERS.map((filter) => (
                        <option key={filter.value} value={filter.value}>
                          {filter.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Statut
                    </span>
                    <select
                      name="status"
                      defaultValue={statusFilter}
                      className="mt-2 w-full min-w-0 truncate rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-10 text-sm text-white outline-none transition focus:border-blue-400/50"
                    >
                      {STATUS_FILTERS.map((filter) => (
                        <option key={filter.value} value={filter.value}>
                          {filter.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Catégorie
                    </span>
                    <select
                      name="category"
                      defaultValue={safeCategoryFilter}
                      className="mt-2 w-full min-w-0 truncate rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-10 text-sm text-white outline-none transition focus:border-blue-400/50"
                    >
                      <option value="all">Toutes les catégories</option>
                      {categories.map((category) => (
                        <option key={category.key} value={category.key}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Année
                    </span>
                    <input
                      name="year"
                      defaultValue={yearFilter}
                      inputMode="numeric"
                      placeholder="Ex : 2026"
                      maxLength={4}
                      className="mt-2 w-full min-w-0 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Mois
                    </span>
                    <select
                      name="month"
                      defaultValue={monthFilter}
                      className="mt-2 w-full min-w-0 truncate rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-10 text-sm text-white outline-none transition focus:border-blue-400/50"
                    >
                      {MONTH_FILTERS.map((month) => (
                        <option key={month.value || "all"} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Tri
                    </span>
                    <select
                      name="sort"
                      defaultValue={sortOption}
                      className="mt-2 w-full min-w-0 truncate rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-10 text-sm text-white outline-none transition focus:border-blue-400/50"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row md:col-span-2 xl:col-span-3 xl:justify-end">
                    <button
                      type="submit"
                      className="rounded-2xl bg-blue-500 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-400 sm:min-w-[130px]"
                    >
                      Appliquer
                    </button>
                    {hasActiveFilters ? (
                      <Link
                        href="/deadlines"
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-center text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white sm:min-w-[110px]"
                      >
                        Reset
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between">
                  <p>
                    {filteredCount} résultat{filteredCount > 1 ? "s" : ""} sur {total}
                    {" "}
                    échéance{total > 1 ? "s" : ""}
                  </p>

                  {activeFilters.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeFilters.map((filter) => (
                        <span
                          key={filter}
                          className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-100"
                        >
                          {filter}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                </form>
              </details>


              {filteredCount === 0 ? (
                <div className="p-8 text-center sm:p-12">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <span className="h-3 w-3 rounded-full bg-blue-300 shadow-[0_0_24px_rgba(147,197,253,0.85)]" />
                  </div>
                  <h3 className="mt-6 text-2xl font-bold text-white">
                    Aucun résultat trouvé
                  </h3>
                  <p className="mx-auto mt-3 max-w-xl text-slate-400">
                    Aucun élément ne correspond aux filtres actuels. Modifiez la
                    recherche, changez le statut ou réinitialisez les filtres pour
                    retrouver l’ensemble du registre.
                  </p>
                  <Link
                    href="/deadlines"
                    className="mt-7 inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                  >
                    Réinitialiser les filtres
                  </Link>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto xl:block">
                    <table className="w-full min-w-[980px]">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <th className="px-6 py-4">Échéance</th>
                          <th className="px-6 py-4 whitespace-nowrap">Catégorie</th>
                          <th className="px-6 py-4 whitespace-nowrap">Date</th>
                          <th className="px-6 py-4 whitespace-nowrap">Statut</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/10">
                        {filteredDeadlines.map((deadline) => (
                          <tr
                            key={deadline.id}
                            className="group transition hover:bg-white/[0.045]"
                          >
                            <td className="px-6 py-5">
                              <div className="flex items-start gap-4">
                                <span
                                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${deadline.indicatorClassName}`}
                                />
                                <div className="min-w-0">
                                  <Link
                                    href={`/deadlines/${deadline.id}`}
                                    className="block truncate font-semibold text-white transition group-hover:text-blue-100"
                                  >
                                    {deadline.title}
                                  </Link>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {deadline.priorityLabel}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
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
                                  </div>
                                  {deadline.document ? (
                                    <Link
                                      href={`/deadlines/documents/${deadline.document.id}`}
                                      className="mt-2 inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15"
                                    >
                                      Voir le document
                                    </Link>
                                  ) : null}
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-5">
                              <span className="inline-flex max-w-[220px] truncate whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm font-medium text-slate-200">
                                {deadline.categoryLabel}
                              </span>
                            </td>

                            <td className="px-6 py-5">
                              <p className="whitespace-nowrap font-medium text-slate-200">
                                {deadline.formattedDate}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {deadline.compactStatus}
                              </p>
                              <p className="mt-1 text-xs text-slate-600">
                                {deadline.recurrenceLabel}
                              </p>
                            </td>

                            <td className="px-6 py-5">
                              <span
                                className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${deadline.statusClassName}`}
                              >
                                {deadline.readableStatus}
                              </span>
                            </td>

                            <td className="px-6 py-5">
                              <div className="flex justify-end gap-2">
                                {deadline.workflowStatus !== "archived" && (deadline.visibility === "personal" || canManageTeam) ? (
                                  <>
                                    <Link
                                      href={`/deadlines/edit/${deadline.id}`}
                                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                                    >
                                      Modifier
                                    </Link>

                                    <DeleteDeadlineButton
                                      id={deadline.id}
                                      title={deadline.title}
                                      category={deadline.category}
                                      documentFilePath={deadline.document?.file_path}
                                    />
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 p-4 xl:hidden">
                    {filteredDeadlines.map((deadline) => (
                      <article
                        key={deadline.id}
                        className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-white/[0.05]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${deadline.indicatorClassName}`}
                              />
                              <Link
                                href={`/deadlines/${deadline.id}`}
                                className="truncate font-semibold text-white transition hover:text-blue-100"
                              >
                                {deadline.title}
                              </Link>
                            </div>
                            <p className="mt-2 text-sm text-slate-400">
                              {deadline.categoryLabel}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
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
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${deadline.statusClassName}`}
                          >
                            {deadline.compactStatus}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-slate-500">Date</p>
                            <p className="mt-1 font-medium text-slate-100">
                              {deadline.formattedDate}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Statut</p>
                            <p className="mt-1 font-medium text-slate-100">
                              {deadline.readableStatus}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Récurrence</p>
                            <p className="mt-1 font-medium text-slate-100">
                              {deadline.recurrenceLabel}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Importance</p>
                            <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.importanceClassName}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${deadline.importanceDotClassName}`} />
                              {deadline.importanceLabel}
                            </span>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-slate-500">Document</p>
                            {deadline.document ? (
                              <Link
                                href={`/deadlines/documents/${deadline.document.id}`}
                                className="mt-1 inline-flex font-medium text-blue-100 transition hover:text-white"
                              >
                                Voir le document joint
                              </Link>
                            ) : (
                              <p className="mt-1 font-medium text-slate-500">
                                Aucun document
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/deadlines/${deadline.id}`}
                            className="flex-1 rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-center text-sm font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white"
                          >
                            Consulter
                          </Link>

                          {deadline.workflowStatus !== "archived" && (deadline.visibility === "personal" || canManageTeam) ? (
                            <>
                              <Link
                                href={`/deadlines/edit/${deadline.id}`}
                                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                              >
                                Modifier
                              </Link>

                              <DeleteDeadlineButton
                                id={deadline.id}
                                title={deadline.title}
                                category={deadline.category}
                                documentFilePath={deadline.document?.file_path}
                              />
                            </>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
