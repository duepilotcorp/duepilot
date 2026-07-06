import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import PrintReportButton from "@/components/PrintReportButton";
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
import { calculateAdministrativeRisk } from "@/lib/administrative-risk";
import {
  DEADLINE_CATEGORY_OPTIONS,
  getDeadlineCategoryDisplay,
  getDeadlineCategoryLabel,
  getDeadlineMainCategoryKey,
} from "@/lib/deadline-categories";
import {
  getDeadlineImportanceBadgeClassName,
  getDeadlineImportanceLabel,
  normalizeDeadlineImportance,
  type DeadlineImportanceLevel,
} from "@/lib/deadline-importance";
import type { DeadlineDocument } from "@/lib/deadline-documents";
import { formatFileSize, getDeadlineDocumentFormatLabel } from "@/lib/deadline-documents";
import { getDeadlineDocumentListsByDeadlineId } from "@/lib/deadline-documents-server";
import { ensureUserOrganization } from "@/lib/organizations";
import { getRecurrenceShortLabel } from "@/lib/recurrence";
import { ACTIVITY_LOG_SELECT_FIELDS, getActivityLogTone, type ActivityLog } from "@/lib/activity-logs";
import { isUserAdmin } from "@/lib/user-roles";
import { getAuthUserDisplayNameMap, getUserDisplayName } from "@/lib/user-display";
import {
  AUDIT_REGISTRY_FILTERS,
  AUDIT_SCOPE_FILTERS,
  getAuditFilterLabels,
  getAvailableAuditYears,
  matchesAuditFilters,
  parseAuditFilters,
  type AuditFilters,
  type AuditPersonOption,
  type SearchParamsRecord,
} from "@/lib/audit-filters";
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
  shortDate: string;
  readableStatus: string;
  statusClassName: string;
  auditToneClassName: string;
  documentCount: number;
  documents: DeadlineDocument[];
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
};

type ProofDocument = DeadlineDocument & {
  deadlineId: number;
  deadlineTitle: string;
  deadlineCategoryLabel: string;
};

type SearchParams = SearchParamsRecord;

const DAY_IN_MS = 1000 * 60 * 60 * 24;

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

function formatShortDate(dueDate: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseLocalDate(dueDate));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getReadableStatus(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) {
    const daysLate = Math.abs(daysUntilDeadline);
    return `En retard de ${daysLate} jour${daysLate > 1 ? "s" : ""}`;
  }

  if (daysUntilDeadline === 0) return "À traiter aujourd’hui";
  if (daysUntilDeadline === 1) return "À traiter demain";
  return `Dans ${daysUntilDeadline} jours`;
}

function getStatusClassName(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) return "border-red-500/25 bg-red-500/10 text-red-100";
  if (daysUntilDeadline <= 7) return "border-orange-500/25 bg-orange-500/10 text-orange-100";
  if (daysUntilDeadline <= 30) return "border-yellow-500/25 bg-yellow-500/10 text-yellow-100";
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-100";
}

function getAuditToneClassName(deadline: {
  daysUntilDeadline: number;
  importanceLevel: DeadlineImportanceLevel;
  workflowStatus: DeadlineWorkflowStatus;
}) {
  if (deadline.daysUntilDeadline < 0 || deadline.importanceLevel === "critical") {
    return "border-red-400/20 bg-red-400/10";
  }

  if (deadline.workflowStatus === "completed") {
    return "border-orange-400/20 bg-orange-400/10";
  }

  if (deadline.daysUntilDeadline <= 30 || deadline.importanceLevel === "high") {
    return "border-yellow-400/20 bg-yellow-400/10";
  }

  return "border-white/10 bg-white/[0.03]";
}

function getAuditPriorityScore(deadline: EnrichedDeadline) {
  let score = 0;

  if (deadline.daysUntilDeadline < 0) score += 100 + Math.abs(deadline.daysUntilDeadline);
  else if (deadline.daysUntilDeadline === 0) score += 85;
  else if (deadline.daysUntilDeadline <= 7) score += 65;
  else if (deadline.daysUntilDeadline <= 30) score += 35;

  if (deadline.importanceLevel === "critical") score += 45;
  if (deadline.importanceLevel === "high") score += 22;
  if (deadline.workflowStatus === "completed") score += 28;

  return score;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}

function isSelectedCategory(filters: AuditFilters, categoryKey: string) {
  return filters.categories.includes(categoryKey as AuditFilters["categories"][number]);
}

export default async function DeadlineAuditPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};
  const filters = parseAuditFilters(params);

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
            Impossible de charger le dossier conformité pour le moment. Réessayez dans quelques instants.
          </p>
        </div>
      </main>
    );
  }

  let memberRows: { user_id: string; role: string | null }[] = [];

  if (userOrganization?.organization.id) {
    const { data: organizationMembers, error: membersError } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", userOrganization.organization.id)
      .eq("status", "active");

    if (!membersError) {
      memberRows = (organizationMembers ?? []) as { user_id: string; role: string | null }[];
    }
  }

  const memberIds = Array.from(new Set([user.id, ...memberRows.map((member) => member.user_id)].filter(Boolean)));
  const memberNameMap = await getAuthUserDisplayNameMap(memberIds);
  const roleByMemberId = new Map(memberRows.map((member) => [member.user_id, member.role ?? "membre"]));
  const memberOptions: AuditPersonOption[] = memberIds.map((memberId) => ({
    id: memberId,
    label: memberNameMap.get(memberId) || (memberId === user.id ? displayName : "Membre DuePilot"),
    helper: memberId === user.id ? "Vous" : roleByMemberId.get(memberId) || "Membre",
  }));
  const selectedPerson = memberOptions.find((member) => member.id === filters.personId);
  const normalizedFilters: AuditFilters = selectedPerson || filters.personId === "all" ? filters : { ...filters, personId: "all" };

  const today = getTodayAtMidnight();
  const deadlineList = deadlines ?? [];
  const allDeadlineIds = deadlineList.map((deadline) => deadline.id);
  const documentsByDeadlineId = await getDeadlineDocumentListsByDeadlineId({
    supabase,
    userId: user.id,
    deadlineIds: allDeadlineIds,
  });

  const allEnrichedDeadlines: EnrichedDeadline[] = deadlineList.map((deadline) => {
    const daysUntilDeadline = getDaysUntilDeadline(deadline.due_date, today);
    const visibility = normalizeDeadlineVisibility(deadline.visibility);
    const workflowStatus = normalizeDeadlineWorkflowStatus(deadline.workflow_status);
    const importanceLevel = normalizeDeadlineImportance(deadline.importance_level);
    const documents = documentsByDeadlineId.get(deadline.id) ?? [];
    const categoryLabel = getDeadlineCategoryDisplay({
      category: deadline.category,
      categoryKey: deadline.category_key,
      customCategoryLabel: deadline.custom_category_label,
    });
    const categoryKey = getDeadlineMainCategoryKey({
      category: deadline.category,
      categoryKey: deadline.category_key,
    });

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
      categoryLabel,
      categoryKey,
      daysUntilDeadline,
      formattedDate: formatDeadlineDate(deadline.due_date),
      shortDate: formatShortDate(deadline.due_date),
      readableStatus: getReadableStatus(daysUntilDeadline),
      statusClassName: getStatusClassName(daysUntilDeadline),
      documentCount: documents.length,
      documents,
      auditToneClassName: getAuditToneClassName({
        daysUntilDeadline,
        importanceLevel,
        workflowStatus,
      }),
    };
  });

  const availableYears = getAvailableAuditYears(allEnrichedDeadlines);
  const filteredDeadlines = allEnrichedDeadlines.filter((deadline) => matchesAuditFilters(deadline, normalizedFilters));
  const filteredDeadlineIds = filteredDeadlines.map((deadline) => deadline.id);
  const activeDeadlines = filteredDeadlines.filter((deadline) => deadline.workflowStatus !== "archived");
  const archivedDeadlines = filteredDeadlines.filter((deadline) => deadline.workflowStatus === "archived");
  const overdueDeadlines = activeDeadlines.filter((deadline) => deadline.daysUntilDeadline < 0);
  const pendingValidationDeadlines = activeDeadlines.filter((deadline) => deadline.workflowStatus === "completed");
  const criticalDeadlines = activeDeadlines
    .filter(
      (deadline) =>
        deadline.daysUntilDeadline <= 30 ||
        deadline.importanceLevel === "critical" ||
        deadline.workflowStatus === "completed"
    )
    .sort((firstDeadline, secondDeadline) => getAuditPriorityScore(secondDeadline) - getAuditPriorityScore(firstDeadline))
    .slice(0, 8);

  const allDocuments: ProofDocument[] = filteredDeadlines.flatMap((deadline) =>
    deadline.documents.map((document) => ({
      ...document,
      deadlineId: deadline.id,
      deadlineTitle: deadline.title,
      deadlineCategoryLabel: deadline.categoryLabel,
    }))
  );
  const recentDocuments = [...allDocuments]
    .sort(
      (firstDocument, secondDocument) =>
        new Date(secondDocument.created_at).getTime() - new Date(firstDocument.created_at).getTime()
    )
    .slice(0, 6);
  const recurrenceCount = activeDeadlines.filter(
    (deadline) => deadline.recurrence_rule && deadline.recurrence_rule !== "none"
  ).length;

  const riskReport = calculateAdministrativeRisk(
    activeDeadlines.map((deadline) => ({
      daysUntilDeadline: deadline.daysUntilDeadline,
      hasDocument: true,
      importanceLevel: deadline.importance_level,
      workflowStatus: deadline.workflow_status,
    }))
  );

  const categoryAudit = Object.values(
    filteredDeadlines.reduce<Record<string, { key: string; label: string; total: number; active: number; archived: number; overdue: number; critical: number; next30: number }>>(
      (accumulator, deadline) => {
        const key = deadline.categoryKey;
        const currentCategory = accumulator[key] ?? {
          key,
          label: getDeadlineCategoryLabel(key),
          total: 0,
          active: 0,
          archived: 0,
          overdue: 0,
          critical: 0,
          next30: 0,
        };

        currentCategory.total += 1;
        if (deadline.workflowStatus === "archived") currentCategory.archived += 1;
        else currentCategory.active += 1;
        if (deadline.workflowStatus !== "archived" && deadline.daysUntilDeadline < 0) currentCategory.overdue += 1;
        if (deadline.workflowStatus !== "archived" && deadline.importanceLevel === "critical") currentCategory.critical += 1;
        if (deadline.workflowStatus !== "archived" && deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 30) currentCategory.next30 += 1;
        accumulator[key] = currentCategory;
        return accumulator;
      },
      {}
    )
  )
    .sort((firstCategory, secondCategory) => {
      const firstScore = firstCategory.overdue * 4 + firstCategory.critical * 3 + firstCategory.next30 + firstCategory.active;
      const secondScore = secondCategory.overdue * 4 + secondCategory.critical * 3 + secondCategory.next30 + secondCategory.active;
      return secondScore - firstScore || secondCategory.total - firstCategory.total;
    })
    .slice(0, 6);

  let recentActivityLogs: ActivityLog[] = [];

  if (filteredDeadlineIds.length > 0) {
    const { data: activityLogs, error: activityError } = await supabase
      .from("activity_logs")
      .select(ACTIVITY_LOG_SELECT_FIELDS)
      .in("deadline_id", filteredDeadlineIds)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!activityError) {
      recentActivityLogs = (activityLogs ?? []) as ActivityLog[];
    } else {
      console.warn("Unable to load audit activity logs", activityError);
    }
  }

  const deadlineTitleById = new Map(filteredDeadlines.map((deadline) => [deadline.id, deadline.title]));
  const filterLabels = getAuditFilterLabels(normalizedFilters, selectedPerson?.label);
  const hasFilteredDeadlines = filteredDeadlines.length > 0;
  const hasActiveRiskScope = activeDeadlines.length > 0;
  const resetHref = "/deadlines/audit";

  const auditChecklist = [
    {
      label: "Retards régularisés",
      ok: overdueDeadlines.length === 0,
      helper: overdueDeadlines.length > 0
        ? `${pluralize(overdueDeadlines.length, "retard")} à régulariser avant présentation.`
        : "Aucun retard actif détecté dans ce périmètre.",
    },
    {
      label: "Workflow équipe à jour",
      ok: pendingValidationDeadlines.length === 0,
      helper: pendingValidationDeadlines.length > 0
        ? `${pluralize(pendingValidationDeadlines.length, "échéance")} attend une validation admin.`
        : "Aucune validation équipe bloquante.",
    },
    {
      label: "Périmètre exploitable",
      ok: filteredDeadlines.length > 0,
      helper: filteredDeadlines.length > 0
        ? `${pluralize(filteredDeadlines.length, "échéance")} analysée dans le dossier filtré.`
        : "Aucune échéance ne correspond aux filtres appliqués.",
    },
    {
      label: "Historique inclus si nécessaire",
      ok: normalizedFilters.registry !== "active" || archivedDeadlines.length === 0,
      helper: normalizedFilters.registry === "active"
        ? "Les échéances traitées peuvent être ajoutées via le filtre Registre."
        : `${pluralize(archivedDeadlines.length, "échéance traitée")} incluse dans le périmètre.`,
    },
  ];

  const auditCards = [
    {
      label: "Score audit",
      value: hasFilteredDeadlines && hasActiveRiskScope ? `${riskReport.score}/100` : "—",
      helper: !hasFilteredDeadlines
        ? "Aucune échéance ne correspond aux filtres"
        : hasActiveRiskScope
          ? riskReport.levelLabel
          : "Aucune échéance active dans ce périmètre",
      href: hasFilteredDeadlines ? "#priorites-audit" : "#filtres-audit",
      className: hasFilteredDeadlines && hasActiveRiskScope ? riskReport.panelClassName : "border-blue-400/20 bg-blue-400/10",
    },
    {
      label: "Échéances analysées",
      value: filteredDeadlines.length,
      helper: `${activeDeadlines.length} active${activeDeadlines.length > 1 ? "s" : ""} · ${archivedDeadlines.length} traitée${archivedDeadlines.length > 1 ? "s" : ""}`,
      href: "#priorites-audit",
      className: "border-cyan-400/20 bg-cyan-400/10",
    },
    {
      label: "Retards actifs",
      value: overdueDeadlines.length,
      helper: overdueDeadlines.length > 0 ? "À régulariser avant audit" : "Aucun retard détecté",
      href: "/deadlines?status=late",
      className: overdueDeadlines.length > 0 ? "border-red-400/20 bg-red-400/10" : "border-emerald-400/20 bg-emerald-400/10",
    },
    {
      label: "Preuves disponibles",
      value: allDocuments.length,
      helper: recentDocuments.length > 0
        ? `${recentDocuments.length} document${recentDocuments.length > 1 ? "s" : ""} récent${recentDocuments.length > 1 ? "s" : ""}`
        : "Aucune preuve ajoutée",
      href: "#preuves",
      className: allDocuments.length > 0 ? "border-emerald-400/20 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]",
    },
  ];

  return (
    <main className="audit-print-root min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="audit-print-hidden pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <div className="audit-print-hidden">
          <AppHeader
            subtitle="Dossier conformité"
          userName={displayName}
          userEmail={user.email}
          organizationName={userOrganization?.organization.name}
          organizationRole={userOrganization?.membership.role}
          isAdminUser={isAdminUser}
            active="audit"
          />
        </div>

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 p-6 shadow-2xl shadow-slate-950/30 sm:p-8 print:mt-0">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Mode audit
              </span>
              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                Dossier conformité filtrable.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                Préparez une synthèse par équipe, personne, catégorie ou période, puis exportez le PDF avec exactement le même périmètre.
              </p>
            </div>
            <div className="audit-print-hidden flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
              <PrintReportButton
                label="Exporter en PDF"
                className="inline-flex justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-300/15 hover:text-white"
              />
              <Link href="/deadlines" className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] hover:text-white">
                Retour aux échéances
              </Link>
            </div>
          </div>
        </section>

        <details id="filtres-audit" className="audit-print-hidden group mt-6 rounded-[2rem] border border-white/10 bg-slate-900/80 p-0 shadow-2xl shadow-slate-950/20">
          <summary className="flex cursor-pointer list-none flex-col gap-4 p-6 marker:hidden sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">Filtres audit</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Construire le périmètre du dossier</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Cliquez pour ouvrir les filtres. L’export PDF reprend le périmètre actuellement appliqué.</p>
            </div>
            <span className="inline-flex items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 transition group-open:border-white/20 group-open:bg-white/[0.06] group-open:text-white">
              <span className="group-open:hidden">Ouvrir les filtres</span>
              <span className="hidden group-open:inline">Réduire les filtres</span>
            </span>
          </summary>

          <div className="border-t border-white/10 p-6 pt-5">
            <form action="/deadlines/audit" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Portée</span>
                  <select name="scope" defaultValue={normalizedFilters.scope} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10">
                    {AUDIT_SCOPE_FILTERS.map((filter) => (
                      <option key={filter.value} value={filter.value}>{filter.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Registre</span>
                  <select name="registry" defaultValue={normalizedFilters.registry} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10">
                    {AUDIT_REGISTRY_FILTERS.map((filter) => (
                      <option key={filter.value} value={filter.value}>{filter.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Personne</span>
                  <select name="person" defaultValue={normalizedFilters.personId} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10">
                    <option value="all">Toute l’équipe</option>
                    {memberOptions.map((member) => (
                      <option key={member.id} value={member.id}>{member.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Année</span>
                  <select name="year" defaultValue={normalizedFilters.year} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10">
                    <option value="">Toutes les années</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Du</span>
                    <input type="date" name="from" defaultValue={normalizedFilters.dateFrom} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Au</span>
                    <input type="date" name="to" defaultValue={normalizedFilters.dateTo} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10" />
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Catégories incluses</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {DEADLINE_CATEGORY_OPTIONS.map((category) => (
                    <label key={category.key} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:bg-cyan-300/10 hover:text-white">
                      <input
                        type="checkbox"
                        name="category"
                        value={category.key}
                        defaultChecked={isSelectedCategory(normalizedFilters, category.key)}
                        className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400 focus:ring-cyan-300/30"
                      />
                      <span>{category.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">Aucune catégorie cochée = toutes les catégories.</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {filterLabels.length > 0 ? (
                    filterLabels.map((label) => (
                      <span key={label} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                        {label}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-400">
                      Aucun filtre avancé appliqué
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href={resetHref} className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] hover:text-white">
                    Réinitialiser
                  </Link>
                  <button type="submit" className="inline-flex justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400">
                    Appliquer les filtres
                  </button>
                </div>
              </div>
            </form>
          </div>
        </details>

        <section className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4 print:border-slate-200 print:bg-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 print:text-slate-500">Périmètre appliqué</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {filterLabels.length > 0 ? (
                  filterLabels.map((label) => (
                    <span key={label} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100 print:border-slate-300 print:bg-white print:text-slate-700">
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-400 print:border-slate-300 print:bg-white print:text-slate-600">
                    Portée standard : échéances actives accessibles
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-300 print:text-slate-700">
              {hasFilteredDeadlines
                ? `${pluralize(filteredDeadlines.length, "échéance")} dans le dossier`
                : "Aucune échéance dans ce périmètre"}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {auditCards.map((card) => (
            <Link key={card.label} href={card.href} className={`group rounded-3xl border p-5 shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:shadow-2xl ${card.className}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-300">{card.label}</p>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-400 transition group-hover:border-white/20 group-hover:text-white">
                  Ouvrir
                </span>
              </div>
              <p className="mt-4 text-4xl font-bold text-white">{card.value}</p>
              <p className="mt-3 text-sm text-slate-400">{card.helper}</p>
            </Link>
          ))}
        </section>

        {!hasFilteredDeadlines ? (
          <section className="mt-6 rounded-[2rem] border border-blue-400/20 bg-blue-400/10 p-6 shadow-2xl shadow-blue-950/20 print:border-slate-200 print:bg-white">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100 print:text-slate-500">Périmètre vide</p>
            <h2 className="mt-2 text-2xl font-bold text-white print:text-slate-950">Aucune échéance ne correspond aux filtres appliqués.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/75 print:text-slate-700">
              Le score audit n’est pas calculé pour éviter une lecture trompeuse. Élargissez le registre, les dates, les catégories ou la personne sélectionnée pour générer un dossier exploitable.
            </p>
            <div className="audit-print-hidden mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href={resetHref} className="inline-flex justify-center rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400">
                Réinitialiser les filtres
              </Link>
              <Link href="/deadlines/new" className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] hover:text-white">
                Ajouter une échéance
              </Link>
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Contrôle rapide</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Checklist de préparation audit</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Les points à sécuriser dans le périmètre filtré.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                {auditChecklist.filter((item) => item.ok).length}/{auditChecklist.length} OK
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {auditChecklist.map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${item.ok ? "border-emerald-400/20 bg-emerald-400/10" : "border-orange-400/20 bg-orange-400/10"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${item.ok ? "bg-emerald-400/20 text-emerald-100" : "bg-orange-400/20 text-orange-100"}`}>
                      {item.ok ? "✓" : "!"}
                    </span>
                    <span>
                      <span className="block font-semibold text-white">{item.label}</span>
                      <span className="mt-1 block text-sm leading-6 text-slate-300">{item.helper}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="priorites-audit" className="scroll-mt-8 rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-200">Priorités audit</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Échéances sensibles</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Retards, urgences et validations à traiter en premier.</p>
              </div>
              <Link href="/deadlines?status=late" className="inline-flex justify-center rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:-translate-y-0.5 hover:border-red-300/40 hover:bg-red-400/15 hover:text-white">
                Filtrer les retards
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {criticalDeadlines.length > 0 ? (
                criticalDeadlines.map((deadline) => (
                  <Link key={deadline.id} href={`/deadlines/${deadline.id}`} className={`group block rounded-3xl border p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-400/10 ${deadline.auditToneClassName}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.importanceClassName}`}>{deadline.importanceLabel}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.workflowClassName}`}>{deadline.workflowLabel}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.statusClassName}`}>{deadline.readableStatus}</span>
                        </div>
                        <h3 className="mt-3 line-clamp-2 text-lg font-bold text-white transition group-hover:text-cyan-100">{deadline.title}</h3>
                        <p className="mt-1 text-sm text-slate-400">{deadline.categoryLabel} · {deadline.formattedDate}</p>
                      </div>
                      <div className="shrink-0 rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm font-semibold text-slate-200">
                        {deadline.documentCount > 0 ? `${deadline.documentCount} doc.` : "Aucun doc."}
                      </div>
                    </div>
                  </Link>
                ))
              ) : !hasFilteredDeadlines ? (
                <div className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5">
                  <p className="font-semibold text-blue-100">Aucune échéance dans ce périmètre.</p>
                  <p className="mt-2 text-sm leading-6 text-blue-100/70">Modifiez les filtres pour afficher les priorités audit correspondantes.</p>
                </div>
              ) : (
                <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                  <p className="font-semibold text-emerald-100">Aucune priorité critique détectée.</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/70">Le périmètre filtré ne contient pas de retard, urgence ou validation bloquante.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="preuves" className="mt-6 scroll-mt-8 rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Preuves disponibles</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Documents récents</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Les dernières preuves du périmètre filtré. Une échéance peut rester valide sans document si aucun justificatif n’est nécessaire.</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              {allDocuments.length} document{allDocuments.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {recentDocuments.length > 0 ? (
              recentDocuments.map((document) => (
                <Link key={document.id} href={`/deadlines/${document.deadlineId}#documents`} className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-emerald-400/10">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white transition group-hover:text-emerald-100">{document.file_name}</span>
                      <span className="mt-1 block text-sm text-slate-400">{document.deadlineTitle}</span>
                    </span>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-300">
                      {getDeadlineDocumentFormatLabel(document.mime_type, document.file_name)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {document.deadlineCategoryLabel} · {formatFileSize(document.file_size)} · ajouté le {formatDateTime(document.created_at)}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
                <p className="font-semibold text-white">Aucun document ajouté pour ce périmètre.</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Les PDF et images joints aux échéances filtrées apparaîtront ici, sans impacter le score audit.</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-200">Catégories</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Domaines du périmètre</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Une lecture par famille, avec les échéances actives et traitées incluses selon vos filtres.</p>

            <div className="mt-5 space-y-3">
              {categoryAudit.length > 0 ? (
                categoryAudit.map((category) => {
                  const riskScore = category.overdue * 4 + category.critical * 3 + category.next30 + category.active;
                  const width = Math.min(100, Math.max(8, riskScore * 10));

                  return (
                    <Link key={category.key} href={`/deadlines?category=${category.key}`} className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-purple-300/40 hover:bg-purple-400/10">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-semibold text-white transition group-hover:text-purple-100">{category.label}</span>
                        <span className="text-slate-400">{category.total} échéance{category.total > 1 ? "s" : ""}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-purple-300" style={{ width: `${width}%` }} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">{category.active} active</span>
                        <span className="rounded-full border border-slate-400/20 bg-white/[0.05] px-2.5 py-1 text-slate-200">{category.archived} traitée</span>
                        <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-red-100">{category.overdue} retard</span>
                        <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2.5 py-1 text-yellow-100">{category.critical} très urgent</span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="font-semibold text-white">Aucune catégorie à analyser.</p>
                  <p className="mt-2 text-sm text-slate-400">Modifiez vos filtres pour élargir le dossier conformité.</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Traçabilité</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Actions récentes</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Les dernières actions rattachées aux échéances filtrées.</p>
              </div>
              <Link href="/deadlines/history" className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white">
                Voir l’historique
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {recentActivityLogs.length > 0 ? (
                recentActivityLogs.map((log) => (
                  <Link key={log.id} href={log.deadline_id ? `/deadlines/${log.deadline_id}` : "/deadlines/history"} className={`group block rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-blue-300/35 hover:bg-blue-400/10 ${getActivityLogTone(log.action)}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <span>
                        <span className="block font-semibold text-white transition group-hover:text-blue-100">{log.title}</span>
                        <span className="mt-1 block text-sm leading-6 text-slate-300">{log.description || (log.deadline_id ? deadlineTitleById.get(log.deadline_id) : "Action DuePilot")}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-slate-400">{formatDateTime(log.created_at)}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="font-semibold text-white">Aucune action récente à afficher.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Le journal se remplira avec les créations, validations, documents et renouvellements du périmètre filtré.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-10 mt-6 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-slate-900/85 to-blue-500/10 p-6 shadow-2xl shadow-cyan-950/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">{hasFilteredDeadlines ? "Synthèse prête" : "Synthèse vide"}</p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {hasFilteredDeadlines ? "Le dossier correspond au périmètre sélectionné." : "Aucune échéance à intégrer au dossier."}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                {hasFilteredDeadlines
                  ? "Vous pouvez inclure les échéances traitées, filtrer par personne et exporter un PDF directement depuis cette page."
                  : "Le PDF peut être exporté, mais il indiquera clairement que le périmètre sélectionné ne contient aucune échéance."}
              </p>
            </div>
            <div className="audit-print-hidden flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
              <Link href="/deadlines?status=late" className="inline-flex justify-center rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:-translate-y-0.5 hover:border-red-300/40 hover:bg-red-400/15 hover:text-white">
                Traiter les retards
              </Link>
              <PrintReportButton
                label="Exporter en PDF"
                className="inline-flex justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:text-white"
              />
              <Link href="/deadlines/new" className="inline-flex justify-center rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400">
                Ajouter une échéance
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
