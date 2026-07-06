import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import DeadlineOnboardingEmptyState from "@/components/DeadlineOnboardingEmptyState";
import {
  buildDeadlineAccessOrFilter,
  DEADLINE_VISIBILITY_LABELS,
  getDeadlineWorkflowLabel,
  getDeadlineVisibilityBadgeClassName,
  getDeadlineWorkflowBadgeClassName,
  normalizeDeadlineVisibility,
  normalizeDeadlineWorkflowStatus,
} from "@/lib/deadline-access";
import { getDeadlineDocumentsByDeadlineId } from "@/lib/deadline-documents-server";
import { ensureUserOrganization } from "@/lib/organizations";
import { getRecurrenceShortLabel } from "@/lib/recurrence";
import {
  getDeadlineImportanceBadgeClassName,
  getDeadlineImportanceLabel,
  normalizeDeadlineImportance,
} from "@/lib/deadline-importance";
import { isUserAdmin } from "@/lib/user-roles";
import { getAuthUserDisplayNameMap, getUserDisplayName } from "@/lib/user-display";
import {
  getDeadlineCategoryDisplay,
  getDeadlineCategoryLabel,
  getDeadlineMainCategoryKey,
} from "@/lib/deadline-categories";
import { createClient } from "@/lib/supabase/server";
import { calculateAdministrativeRisk, getRiskDriverClassName } from "@/lib/administrative-risk";

export const dynamic = "force-dynamic";

type Deadline = {
  id: number;
  title: string;
  category: string;
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

function formatShortDateTime(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
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

function getStatusClassName(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) {
    return "border-red-500/25 bg-red-500/10 text-red-200";
  }

  if (daysUntilDeadline <= 7) {
    return "border-orange-500/25 bg-orange-500/10 text-orange-200";
  }

  if (daysUntilDeadline <= 30) {
    return "border-yellow-500/25 bg-yellow-500/10 text-yellow-100";
  }

  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
}

const DASHBOARD_MONTHS = [
  "Jan.",
  "Fév.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
] as const;

function getMiniCalendarRisk({
  total,
  lateCount,
  criticalCount,
  next30Count,
  pendingValidationCount,
}: {
  total: number;
  lateCount: number;
  criticalCount: number;
  next30Count: number;
  pendingValidationCount: number;
}) {
  if (total === 0) {
    return {
      riskLabel: "Libre",
      cardClassName: "border-white/10 bg-white/[0.025] hover:border-white/20",
      dotClassName: "bg-slate-500/50",
      textClassName: "text-slate-500",
    };
  }

  if (lateCount > 0 || criticalCount > 0) {
    return {
      riskLabel: "Critique",
      cardClassName: "border-red-400/25 bg-red-400/10 hover:border-red-300/45",
      dotClassName: "bg-red-400 shadow-[0_0_20px_rgba(248,113,113,0.45)]",
      textClassName: "text-red-100",
    };
  }

  if (pendingValidationCount > 0 || next30Count > 0) {
    return {
      riskLabel: "À surveiller",
      cardClassName: "border-orange-400/25 bg-orange-400/10 hover:border-orange-300/45",
      dotClassName: "bg-orange-300 shadow-[0_0_20px_rgba(253,186,116,0.4)]",
      textClassName: "text-orange-100",
    };
  }

  if (total >= 3) {
    return {
      riskLabel: "Chargé",
      cardClassName: "border-yellow-400/25 bg-yellow-400/10 hover:border-yellow-300/45",
      dotClassName: "bg-yellow-300 shadow-[0_0_20px_rgba(253,224,71,0.35)]",
      textClassName: "text-yellow-100",
    };
  }

  return {
    riskLabel: "Calme",
    cardClassName: "border-emerald-400/25 bg-emerald-400/10 hover:border-emerald-300/45",
    dotClassName: "bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)]",
    textClassName: "text-emerald-100",
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();

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

  const { data: deadlines, error } = await supabase
    .from("deadlines")
    .select("id, title, category, category_key, custom_category_label, due_date, recurrence_rule, importance_level, created_at, user_id, organization_id, visibility, workflow_status")
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
            Impossible de charger le dashboard pour le moment. Réessayez dans
            quelques instants.
          </p>
        </div>
      </main>
    );
  }

  const deadlineList = deadlines ?? [];
  const today = getTodayAtMidnight();
  const documentsByDeadlineId = await getDeadlineDocumentsByDeadlineId({
    supabase,
    userId: user.id,
    deadlineIds: deadlineList.map((deadline) => deadline.id),
  });

  const enrichedDeadlines = deadlineList.map((deadline) => {
    const daysUntilDeadline = getDaysUntilDeadline(deadline.due_date, today);

    return {
      ...deadline,
      daysUntilDeadline,
      readableStatus: getReadableStatus(daysUntilDeadline),
      statusClassName: getStatusClassName(daysUntilDeadline),
      formattedDate: formatDeadlineDate(deadline.due_date),
      visibility: normalizeDeadlineVisibility(deadline.visibility),
      workflowStatus: normalizeDeadlineWorkflowStatus(deadline.workflow_status),
      visibilityLabel: DEADLINE_VISIBILITY_LABELS[normalizeDeadlineVisibility(deadline.visibility)],
      workflowLabel: getDeadlineWorkflowLabel({ status: normalizeDeadlineWorkflowStatus(deadline.workflow_status), visibility: normalizeDeadlineVisibility(deadline.visibility) }),
      visibilityClassName: getDeadlineVisibilityBadgeClassName(normalizeDeadlineVisibility(deadline.visibility)),
      workflowClassName: getDeadlineWorkflowBadgeClassName(normalizeDeadlineWorkflowStatus(deadline.workflow_status)),
      recurrenceLabel: getRecurrenceShortLabel(deadline.recurrence_rule),
      importanceLevel: normalizeDeadlineImportance(deadline.importance_level),
      importanceLabel: getDeadlineImportanceLabel(deadline.importance_level),
      importanceClassName: getDeadlineImportanceBadgeClassName(deadline.importance_level),
      categoryLabel: getDeadlineCategoryDisplay({
        category: deadline.category,
        categoryKey: deadline.category_key,
        customCategoryLabel: deadline.custom_category_label,
      }),
      categoryKey: getDeadlineMainCategoryKey({ category: deadline.category, categoryKey: deadline.category_key }),
      document: documentsByDeadlineId.get(deadline.id) ?? null,
    };
  });

  const activeDeadlines = enrichedDeadlines.filter(
    (deadline) => deadline.workflowStatus !== "archived"
  );
  const archivedCount = enrichedDeadlines.length - activeDeadlines.length;
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
  const documentCount = activeDeadlines.filter((deadline) => deadline.document).length;
  const teamCount = activeDeadlines.filter((deadline) => deadline.visibility === "team").length;
  const personalCount = activeDeadlines.filter((deadline) => deadline.visibility === "personal").length;
  const inProgressCount = activeDeadlines.filter((deadline) => deadline.workflowStatus === "in_progress").length;
  const pendingValidationCount = activeDeadlines.filter((deadline) => deadline.workflowStatus === "completed").length;
  const recurringCount = activeDeadlines.filter((deadline) => deadline.recurrence_rule && deadline.recurrence_rule !== "none").length;
  const isAdminUser = await isUserAdmin(user.id);
  const displayName = getUserDisplayName(user);

  const urgentDeadlines = activeDeadlines
    .filter((deadline) => deadline.daysUntilDeadline <= 30)
    .slice(0, 5);
  const nextCriticalDeadline = activeDeadlines[0];
  const riskReport = calculateAdministrativeRisk(
    activeDeadlines.map((deadline) => ({
      daysUntilDeadline: deadline.daysUntilDeadline,
      hasDocument: Boolean(deadline.document),
      importanceLevel: deadline.importance_level,
      workflowStatus: deadline.workflow_status,
    }))
  );

  const categoryBreakdown = Object.entries(
    activeDeadlines.reduce<Record<string, number>>((accumulator, deadline) => {
      const category = getDeadlineCategoryLabel(deadline.categoryKey);
      accumulator[category] = (accumulator[category] ?? 0) + 1;
      return accumulator;
    }, {})
  )
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const dashboardCalendarYear = today.getFullYear();
  const dashboardCalendarMonths = DASHBOARD_MONTHS.map((monthLabel, monthIndex) => {
    const monthDeadlines = activeDeadlines.filter((deadline) => {
      const deadlineDate = parseLocalDate(deadline.due_date);
      return deadlineDate.getFullYear() === dashboardCalendarYear && deadlineDate.getMonth() === monthIndex;
    });
    const lateInMonthCount = monthDeadlines.filter((deadline) => deadline.daysUntilDeadline < 0).length;
    const criticalInMonthCount = monthDeadlines.filter(
      (deadline) => deadline.importanceLevel === "critical"
    ).length;
    const next30InMonthCount = monthDeadlines.filter(
      (deadline) => deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 30
    ).length;
    const pendingValidationInMonthCount = monthDeadlines.filter(
      (deadline) => deadline.workflowStatus === "completed"
    ).length;
    const risk = getMiniCalendarRisk({
      total: monthDeadlines.length,
      lateCount: lateInMonthCount,
      criticalCount: criticalInMonthCount,
      next30Count: next30InMonthCount,
      pendingValidationCount: pendingValidationInMonthCount,
    });

    return {
      value: String(monthIndex + 1).padStart(2, "0"),
      monthLabel,
      total: monthDeadlines.length,
      lateCount: lateInMonthCount,
      criticalCount: criticalInMonthCount,
      next30Count: next30InMonthCount,
      pendingValidationCount: pendingValidationInMonthCount,
      ...risk,
    };
  });
  const dashboardCalendarTotal = dashboardCalendarMonths.reduce(
    (sum, month) => sum + month.total,
    0
  );
  const dashboardCalendarRiskCount = dashboardCalendarMonths.filter(
    (month) => month.lateCount > 0 || month.criticalCount > 0
  ).length;
  const dashboardBusiestMonth = [...dashboardCalendarMonths].sort((a, b) => b.total - a.total)[0];
  const latestTeamDeadlinesBase = activeDeadlines
    .filter((deadline) => deadline.visibility === "team")
    .sort(
      (firstDeadline, secondDeadline) =>
        new Date(secondDeadline.created_at).getTime() -
        new Date(firstDeadline.created_at).getTime()
    )
    .slice(0, 3);
  const latestTeamAuthorNames = await getAuthUserDisplayNameMap(
    latestTeamDeadlinesBase.map((deadline) => deadline.user_id)
  );
  const latestTeamDeadlines = latestTeamDeadlinesBase.map((deadline) => ({
    ...deadline,
    createdLabel: formatShortDateTime(deadline.created_at),
    authorName:
      latestTeamAuthorNames.get(deadline.user_id ?? "") ??
      (deadline.user_id === user.id ? displayName : "Administrateur"),
  }));

  const statCards = [
    {
      label: "En retard",
      value: lateCount,
      helper: "À traiter en priorité",
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
      helper: `${inProgressCount} en cours · ${pendingValidationCount} à valider`,
      href: "/deadlines?status=next30",
      className: "border-yellow-500/20 bg-yellow-500/10 hover:border-yellow-400/40",
      valueClassName: "text-yellow-100",
    },
    {
      label: "Total suivies",
      value: total,
      helper: `${teamCount} équipe · ${personalCount} perso · ${recurringCount} récurrentes`,
      href: "/deadlines",
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
          subtitle="Espace de suivi"
          userName={displayName}
          userEmail={user.email}
          organizationName={userOrganization?.organization.name}
          organizationRole={userOrganization?.membership.role}
          isAdminUser={isAdminUser}
          active="dashboard"
        />

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
Vue d’ensemble
                </div>

                <p className="mt-5 text-sm font-medium text-slate-300">
                  Entreprise : {userOrganization?.organization.name ?? "Mon entreprise"}
                </p>

                <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Ce qui demande votre attention.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  {lateCount > 0
                    ? `${lateCount} échéance${lateCount > 1 ? "s" : ""} en retard à traiter en priorité.`
                    : next7Count > 0
                      ? `${next7Count} échéance${next7Count > 1 ? "s" : ""} arrive${next7Count > 1 ? "nt" : ""} sous 7 jours.`
                      : "Aucune urgence immédiate détectée."}
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/deadlines"
                    className="inline-flex justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
                  >
                    Accéder aux échéances
                  </Link>
                  <Link
                    href="/deadlines/calendar"
                    className="inline-flex justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:text-white"
                  >
                    Calendrier conformité
                  </Link>
                  <Link
                    href="/deadlines/new"
                    className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                  >
                    Ajouter une échéance
                  </Link>
                </div>
              </div>

              <div className={`rounded-3xl border p-5 ${riskReport.panelClassName}`}>
                <div className="flex items-center justify-between gap-4">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskReport.badgeClassName}`}
                  >
                    {riskReport.levelLabel}
                  </span>
                  <span className="text-sm font-medium text-slate-300">
                    Score DuePilot
                  </span>
                </div>

                <div className="mt-5 flex items-end gap-2" aria-label={`Score DuePilot ${riskReport.score} sur 100`}>
                  <p className="text-5xl font-bold tracking-tight text-white">
                    {riskReport.score}
                  </p>
                  <p className="pb-2 text-sm font-semibold text-slate-300">/100</p>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${riskReport.progressClassName}`}
                    style={{ width: `${riskReport.score}%` }}
                  />
                </div>

                <h2 className="mt-5 text-lg font-semibold text-white">
                  {riskReport.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {riskReport.description}
                </p>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {riskReport.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className={`rounded-2xl border px-3 py-3 ${metric.className}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em]">
                          {metric.label}
                        </span>
                        <span className="text-lg font-bold">{metric.value}</span>
                      </div>
                      <p className="mt-1 text-xs opacity-75">{metric.helper}</p>
                    </div>
                  ))}
                </div>
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

        <section className="mt-6 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-slate-900/85 to-blue-500/10 p-5 shadow-2xl shadow-cyan-950/20 animate-rise-in-delay-1 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                Nouvelles échéances équipe
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Les derniers ajouts à ne pas manquer
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Les 3 dernières échéances partagées avec l’équipe apparaissent ici pour que chaque membre voie immédiatement les nouveautés.
              </p>
            </div>

            <Link
              href="/deadlines?scope=team&sort=created_desc"
              className="inline-flex justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-400/15 hover:text-white"
            >
              Voir les derniers ajouts équipe
            </Link>
          </div>

          {latestTeamDeadlines.length > 0 ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {latestTeamDeadlines.map((deadline) => (
                <Link
                  key={deadline.id}
                  href={`/deadlines/${deadline.id}`}
                  className="group rounded-3xl border border-white/10 bg-slate-950/35 p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-400/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.importanceClassName}`}>
                      {deadline.importanceLabel}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {deadline.createdLabel}
                    </span>
                  </div>
                  <h3 className="mt-4 line-clamp-2 text-lg font-bold text-white transition group-hover:text-cyan-100">
                    {deadline.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {deadline.categoryLabel} · {deadline.formattedDate}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.statusClassName}`}>
                      {deadline.readableStatus}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-300">
                      Ajoutée par {deadline.authorName}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <p className="font-semibold text-white">Aucune échéance équipe récente.</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Les prochaines échéances partagées par l’organisation apparaîtront automatiquement ici.
              </p>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20 animate-rise-in-delay-1 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                Calendrier conformité
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Vue rapide {dashboardCalendarYear}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Repérez en un coup d’œil les mois chargés, critiques ou calmes sans quitter le dashboard.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <span className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                {dashboardCalendarTotal} échéance{dashboardCalendarTotal > 1 ? "s" : ""} cette année
              </span>
              <span className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-100">
                {dashboardCalendarRiskCount} mois à risque
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12">
            {dashboardCalendarMonths.map((month) => (
              <Link
                key={month.value}
                href={`/deadlines/calendar?year=${dashboardCalendarYear}&month=${month.value}`}
                className={`group rounded-2xl border p-3 transition hover:-translate-y-0.5 ${month.cardClassName}`}
                title={`${month.monthLabel} ${dashboardCalendarYear} · ${month.total} échéance${month.total > 1 ? "s" : ""} · ${month.riskLabel}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-white">{month.monthLabel}</span>
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${month.dotClassName}`} />
                </div>
                <p className="mt-3 text-3xl font-bold text-white">{month.total}</p>
                <p className={`mt-1 truncate text-[11px] font-semibold ${month.textClassName}`}>
                  {month.riskLabel}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-400">
              {dashboardBusiestMonth && dashboardBusiestMonth.total > 0
                ? `${dashboardBusiestMonth.monthLabel} est le mois le plus chargé avec ${dashboardBusiestMonth.total} échéance${dashboardBusiestMonth.total > 1 ? "s" : ""}.`
                : "Aucune échéance active planifiée sur l’année en cours."}
            </p>
            <Link
              href={`/deadlines/calendar?year=${dashboardCalendarYear}`}
              className="inline-flex justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:text-white"
            >
              Ouvrir le calendrier complet
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] animate-rise-in-delay-1">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Signaux de risque
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  Ce qui influence le score
                </h2>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskReport.badgeClassName}`}>
                {riskReport.levelLabel}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {riskReport.drivers.map((driver) => (
                <div
                  key={`${driver.label}-${driver.description}`}
                  className={`rounded-2xl border p-4 ${getRiskDriverClassName(driver.severity)}`}
                >
                  <p className="font-semibold">{driver.label}</p>
                  <p className="mt-1 text-sm opacity-75">{driver.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Plan d’action
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Recommandations prioritaires
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              DuePilot transforme le score en actions concrètes pour réduire le risque administratif.
            </p>

            <div className="mt-5 space-y-3">
              {riskReport.recommendations.map((recommendation, index) => (
                <Link
                  key={`${recommendation.title}-${recommendation.href}`}
                  href={recommendation.href}
                  className="group flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-emerald-400/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-sm font-bold text-emerald-100">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-semibold text-white transition group-hover:text-emerald-100">
                      {recommendation.title}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-slate-400">
                      {recommendation.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {total === 0 ? (
          <DeadlineOnboardingEmptyState variant="dashboard" />
        ) : (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.72fr] animate-rise-in-delay-1">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Priorités à traiter
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Les éléments qui méritent une action en premier.
                  </p>
                </div>

                <Link
                  href="/deadlines"
                  className="inline-flex justify-center rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-400"
                >
                  Voir les échéances
                </Link>
              </div>

              <div className="mt-6 space-y-3">
                {urgentDeadlines.length > 0 ? (
                  urgentDeadlines.map((deadline) => (
                    <Link
                      key={deadline.id}
                      href={`/deadlines/${deadline.id}`}
                      className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-white transition group-hover:text-blue-100">
                            {deadline.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {deadline.categoryLabel} · {deadline.formattedDate}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${deadline.importanceClassName}`}>
                              {deadline.importanceLabel}
                            </span>
                            {deadline.document ? (
                              <span className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs font-semibold text-blue-100">
                                Document joint
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${deadline.statusClassName}`}
                        >
                          {deadline.readableStatus}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                    <p className="font-semibold text-emerald-100">
                      Aucune urgence sur les 30 prochains jours.
                    </p>
                    <p className="mt-2 text-sm text-emerald-100/70">
                      Votre planning administratif est actuellement sous contrôle.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Prochaine action
                </p>

                {nextCriticalDeadline ? (
                  <div className="mt-5">
                    <h2 className="text-2xl font-bold text-white">
                      {nextCriticalDeadline.title}
                    </h2>
                    <p className="mt-2 text-slate-400">
                      {nextCriticalDeadline.category} · {nextCriticalDeadline.formattedDate}
                    </p>
                    <span
                      className={`mt-5 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${nextCriticalDeadline.statusClassName}`}
                    >
                      {nextCriticalDeadline.readableStatus}
                    </span>
                    <Link
                      href={`/deadlines/${nextCriticalDeadline.id}`}
                      className="mt-6 inline-flex w-full justify-center rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-400"
                    >
                      Ouvrir le détail
                    </Link>
                    {nextCriticalDeadline.document ? (
                      <Link
                        href={`/deadlines/${nextCriticalDeadline.id}#documents`}
                        className="mt-3 inline-flex w-full justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white"
                      >
                        Voir les documents
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
                <h2 className="text-xl font-bold text-white">
                  Répartition par catégorie
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Les domaines les plus représentés.
                </p>

                <div className="mt-5 space-y-4">
                  {categoryBreakdown.map((item) => (
                    <div key={item.category}>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-medium text-slate-200">
                          {item.category}
                        </span>
                        <span className="text-slate-400">
                          {item.count} · {item.percentage}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-blue-300"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
