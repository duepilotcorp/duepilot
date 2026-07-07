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
};

type EnrichedDeadline = Deadline & {
  categoryLabel: string;
  categoryKey: string;
  formattedDate: string;
  compactDate: string;
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
type ScopeFilter = "all" | "team" | "personal";
type SortOption = "due_desc" | "due_asc" | "title_asc" | "created_desc";

const SCOPE_FILTERS: { value: ScopeFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "team", label: "Équipe" },
  { value: "personal", label: "Personnel" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "due_desc", label: "Date d’échéance la plus récente" },
  { value: "due_asc", label: "Date d’échéance la plus ancienne" },
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

function getSearchParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
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
    year: "numeric",
  }).format(parseLocalDate(dueDate));
}

function getScopeFilter(value: string): ScopeFilter {
  return SCOPE_FILTERS.some((filter) => filter.value === value)
    ? (value as ScopeFilter)
    : "all";
}

function getSortOption(value: string): SortOption {
  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as SortOption)
    : "due_desc";
}

function matchesScopeFilter(deadline: EnrichedDeadline, scope: ScopeFilter) {
  if (scope === "team") return deadline.visibility === "team";
  if (scope === "personal") return deadline.visibility === "personal";
  return true;
}

function sortDeadlines(deadlines: EnrichedDeadline[], sort: SortOption) {
  return [...deadlines].sort((firstDeadline, secondDeadline) => {
    if (sort === "due_asc") {
      return (
        parseLocalDate(firstDeadline.due_date).getTime() -
        parseLocalDate(secondDeadline.due_date).getTime()
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
      parseLocalDate(secondDeadline.due_date).getTime() -
      parseLocalDate(firstDeadline.due_date).getTime()
    );
  });
}

function buildFilterSummary({
  searchQuery,
  scopeFilter,
  categoryFilter,
  yearFilter,
  monthFilter,
}: {
  searchQuery: string;
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

export default async function DeadlineHistoryPage({
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
  const displayName = getUserDisplayName(user);

  const [isAdminUser, deadlinesResult] = await Promise.all([
    isUserAdmin(user.id),
    supabase
      .from("deadlines")
      .select("id, title, category, category_key, custom_category_label, due_date, recurrence_rule, importance_level, created_at, user_id, organization_id, visibility, workflow_status")
      .or(
        buildDeadlineAccessOrFilter({
          userId: user.id,
          organizationId: userOrganization?.organization.id,
        })
      )
      .eq("workflow_status", "archived")
    .order("due_date", { ascending: false })
      .returns<Deadline[]>(),
  ]);

  const { data: deadlines, error } = deadlinesResult;

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Impossible de charger l’historique pour le moment. Réessayez dans quelques instants.
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

  const archivedDeadlines: EnrichedDeadline[] = deadlineList.map((deadline) => {
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
      categoryLabel: getDeadlineCategoryDisplay({
        category: deadline.category,
        categoryKey: deadline.category_key,
        customCategoryLabel: deadline.custom_category_label,
      }),
      categoryKey: getDeadlineMainCategoryKey({ category: deadline.category, categoryKey: deadline.category_key }),
      formattedDate: formatDeadlineDate(deadline.due_date),
      compactDate: formatCompactDate(deadline.due_date),
      document: documentsByDeadlineId.get(deadline.id) ?? null,
    };
  });

  const usedCategoryKeys = new Set(archivedDeadlines.map((deadline) => deadline.categoryKey));
  const categories = DEADLINE_CATEGORY_OPTIONS.filter((category) =>
    usedCategoryKeys.has(category.key)
  );

  const safeCategoryFilter = categories.some((category) => category.key === categoryFilter)
    ? categoryFilter
    : "all";

  const filteredDeadlines = sortDeadlines(
    archivedDeadlines.filter((deadline) => {
      const searchableContent = [
        deadline.title,
        deadline.categoryLabel,
        deadline.formattedDate,
        deadline.visibilityLabel,
        deadline.workflowLabel,
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
        matchesScopeFilter(deadline, scopeFilter)
      );
    }),
    sortOption
  );

  const total = archivedDeadlines.length;
  const filteredCount = filteredDeadlines.length;
  const teamCount = archivedDeadlines.filter((deadline) => deadline.visibility === "team").length;
  const personalCount = archivedDeadlines.filter((deadline) => deadline.visibility === "personal").length;
  const documentCount = archivedDeadlines.filter((deadline) => deadline.document).length;
  const criticalCount = archivedDeadlines.filter((deadline) => deadline.importanceLevel === "critical").length;
  const activeFilters = buildFilterSummary({
    searchQuery,
    scopeFilter,
    categoryFilter: safeCategoryFilter,
    yearFilter,
    monthFilter,
  });
  const hasActiveFilters = activeFilters.length > 0 || sortOption !== "due_desc";
  const filterFormKey = [
    searchQuery,
    scopeFilter,
    safeCategoryFilter,
    yearFilter,
    monthFilter,
    sortOption,
  ].join("|");

  const exportParams = new URLSearchParams({ scope: "history", sort: sortOption });
  if (searchQuery) exportParams.set("q", searchQuery);
  if (scopeFilter !== "all") exportParams.set("visibility", scopeFilter);
  if (safeCategoryFilter !== "all") exportParams.set("category", safeCategoryFilter);
  if (yearFilter) exportParams.set("year", yearFilter);
  if (monthFilter) exportParams.set("month", monthFilter);
  const csvExportHref = `/api/deadlines/export?${exportParams.toString()}`;

  const statCards = [
    {
      label: "Archivées",
      value: total,
      helper: "Échéances clôturées",
      className: "border-slate-400/20 bg-slate-400/10",
      valueClassName: "text-slate-100",
    },
    {
      label: "Équipe",
      value: teamCount,
      helper: "Validées côté organisation",
      className: "border-cyan-400/20 bg-cyan-400/10",
      valueClassName: "text-cyan-100",
    },
    {
      label: "Personnel",
      value: personalCount,
      helper: "Clôturées individuellement",
      className: "border-violet-400/20 bg-violet-400/10",
      valueClassName: "text-violet-100",
    },
    {
      label: "Documents",
      value: documentCount,
      helper: `${criticalCount} très urgente${criticalCount > 1 ? "s" : ""}`,
      className: "border-blue-400/20 bg-blue-400/10",
      valueClassName: "text-blue-100",
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
          subtitle="Historique des échéances"
          userName={displayName}
          userEmail={user.email}
          organizationName={userOrganization?.organization.name}
          organizationRole={userOrganization?.membership.role}
          isAdminUser={isAdminUser}
          active="history"
          exportHref={csvExportHref}
        />

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-slate-400/20 bg-slate-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-100">
                  Historique
                </div>

                <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Vos échéances archivées.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Consultez les échéances déjà traitées sans les mélanger avec le registre actif.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {total} échéance{total > 1 ? "s" : ""} archivée{total > 1 ? "s" : ""}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {teamCount} équipe · {personalCount} perso
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {documentCount} document{documentCount > 1 ? "s" : ""}
                  </span>
                  <Link
                    href="/deadlines"
                    className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white"
                  >
                    Retour aux échéances actives
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-400/20 bg-slate-400/10 p-5 text-slate-100">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                  Archives séparées
                </p>
                <h2 className="mt-4 text-2xl font-bold text-white">
                  Le registre actif reste lisible.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-200/80">
                  Les échéances archivées ne déclenchent plus de rappels, mais restent consultables avec leurs documents, statuts et niveaux d’importance.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-3xl border p-5 shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:shadow-2xl ${card.className}`}
            >
              <p className="text-sm font-medium text-slate-300">{card.label}</p>
              <p className={`mt-4 text-5xl font-bold ${card.valueClassName}`}>
                {card.value}
              </p>
              <p className="mt-3 text-sm text-slate-400">{card.helper}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-slate-950/20 animate-rise-in-delay-1">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Historique des échéances
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {filteredCount} résultat{filteredCount > 1 ? "s" : ""} affiché{filteredCount > 1 ? "s" : ""} sur {total}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-300">
                <span className="rounded-full border border-slate-400/20 bg-slate-400/10 px-3 py-1 text-slate-100">
                  {total} archivées
                </span>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                  {teamCount} équipe
                </span>
                <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-violet-100">
                  {personalCount} perso
                </span>
              </div>
            </div>
          </div>

          {total === 0 ? (
            <div className="p-8 text-center sm:p-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <span className="h-3 w-3 rounded-full bg-slate-300 shadow-[0_0_24px_rgba(226,232,240,0.6)]" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-white">
                Aucun historique pour le moment
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                Les échéances personnelles terminées et les échéances équipe validées apparaîtront ici une fois archivées.
              </p>
              <Link
                href="/deadlines"
                className="mt-7 inline-flex justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 px-5 py-3 font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white"
              >
                Voir les échéances actives
              </Link>
            </div>
          ) : (
            <>
              <details key={filterFormKey} className="group border-b border-white/10 bg-slate-950/20">
                <summary className="flex cursor-pointer list-none flex-col gap-3 p-5 transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:p-6 [&::-webkit-details-marker]:hidden">
                  <div>
                    <p className="text-sm font-bold text-white">Filtres et tri</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {hasActiveFilters
                        ? `${activeFilters.length + (sortOption !== "due_desc" ? 1 : 0)} réglage${activeFilters.length + (sortOption !== "due_desc" ? 1 : 0) > 1 ? "s" : ""} actif${activeFilters.length + (sortOption !== "due_desc" ? 1 : 0) > 1 ? "s" : ""}`
                        : "Ouvrir pour rechercher, trier ou filtrer l’historique."}
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

                <form action="/deadlines/history" className="border-t border-white/10 p-5 sm:p-6">
                  <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr_0.75fr_0.75fr_0.75fr_auto] xl:items-end">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Recherche
                      </span>
                      <input
                        type="search"
                        name="q"
                        defaultValue={searchQuery}
                        placeholder="Nom, catégorie, document…"
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:bg-white/[0.07]"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Portée
                      </span>
                      <select
                        name="scope"
                        defaultValue={scopeFilter}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
                      >
                        {SCOPE_FILTERS.map((filter) => (
                          <option key={filter.value} value={filter.value}>
                            {filter.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Catégorie
                      </span>
                      <select
                        name="category"
                        defaultValue={safeCategoryFilter}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
                      >
                        <option value="all">Toutes les catégories</option>
                        {categories.map((category) => (
                          <option key={category.key} value={category.key}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Année
                      </span>
                      <input
                        name="year"
                        defaultValue={yearFilter}
                        inputMode="numeric"
                        placeholder="Ex : 2026"
                        maxLength={4}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Mois
                      </span>
                      <select
                        name="month"
                        defaultValue={monthFilter}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
                      >
                        {MONTH_FILTERS.map((month) => (
                          <option key={month.value || "all"} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Tri
                      </span>
                      <select
                        name="sort"
                        defaultValue={sortOption}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
                      >
                        {SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 xl:flex-none"
                      >
                        Appliquer
                      </button>
                      {hasActiveFilters ? (
                        <Link
                          href="/deadlines/history"
                          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                        >
                          Reset
                        </Link>
                      ) : null}
                    </div>
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
                    Aucun élément archivé ne correspond aux filtres actuels. Modifiez la recherche ou réinitialisez les filtres.
                  </p>
                  <Link
                    href="/deadlines/history"
                    className="mt-7 inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                  >
                    Réinitialiser les filtres
                  </Link>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[900px]">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <th className="px-6 py-4">Échéance</th>
                          <th className="px-6 py-4 whitespace-nowrap">Catégorie</th>
                          <th className="px-6 py-4 whitespace-nowrap">Date d’échéance</th>
                          <th className="px-6 py-4 whitespace-nowrap">Statut</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/10">
                        {filteredDeadlines.map((deadline) => (
                          <tr key={deadline.id} className="group transition hover:bg-white/[0.045]">
                            <td className="px-6 py-5">
                              <div className="flex items-start gap-4">
                                <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${deadline.importanceDotClassName}`} />
                                <div className="min-w-0">
                                  <Link
                                    href={`/deadlines/${deadline.id}`}
                                    className="block truncate font-semibold text-white transition group-hover:text-blue-100"
                                  >
                                    {deadline.title}
                                  </Link>
                                  <p className="mt-1 text-sm text-slate-500">
                                    Archivée · {deadline.recurrenceLabel}
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
                                      href={`/deadlines/${deadline.id}#documents`}
                                      className="mt-2 inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15"
                                    >
                                      Documents disponibles
                                    </Link>
                                  ) : null}
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-5">
                              <span className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm font-medium text-slate-200">
                                {deadline.categoryLabel}
                              </span>
                            </td>

                            <td className="px-6 py-5">
                              <p className="whitespace-nowrap font-medium text-slate-200">
                                {deadline.formattedDate}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {deadline.compactDate}
                              </p>
                            </td>

                            <td className="px-6 py-5">
                              <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${deadline.workflowClassName}`}>
                                Archivée
                              </span>
                            </td>

                            <td className="px-6 py-5">
                              <div className="flex justify-end gap-2">
                                <Link
                                  href={`/deadlines/${deadline.id}`}
                                  className="rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-sm font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white"
                                >
                                  Consulter
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 p-4 lg:hidden">
                    {filteredDeadlines.map((deadline) => (
                      <article
                        key={deadline.id}
                        className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-white/[0.05]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${deadline.importanceDotClassName}`} />
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
                                Archivée
                              </span>
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.importanceClassName}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${deadline.importanceDotClassName}`} />
                                {deadline.importanceLabel}
                              </span>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-full border border-slate-400/25 bg-slate-400/10 px-3 py-1 text-xs font-semibold text-slate-100">
                            {deadline.compactDate}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-slate-500">Date d’échéance</p>
                            <p className="mt-1 font-medium text-slate-100">
                              {deadline.formattedDate}
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
                          <div>
                            <p className="text-slate-500">Document</p>
                            {deadline.document ? (
                              <Link
                                href={`/deadlines/${deadline.id}#documents`}
                                className="mt-1 inline-flex font-medium text-blue-100 transition hover:text-white"
                              >
                                Voir les documents dans le détail
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
