import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ActivityLogList from "@/components/ActivityLogList";
import DeleteDeadlineButton from "@/components/DeleteDeadlineButton";
import RenewDeadlineForm from "@/components/RenewDeadlineForm";
import TeamDeadlineWorkflowActions from "@/components/TeamDeadlineWorkflowActions";
import RenewalHistoryList from "@/components/RenewalHistoryList";
import DeadlineTreatmentPanel from "@/components/DeadlineTreatmentPanel";
import { getDeadlineActivityLogs } from "@/lib/activity-logs";
import {
  buildDeadlineAccessOrFilter,
  canContributeToTeamDeadlines,
  canEditDeadline,
  canEditDeadlineTreatment,
  canDeleteDeadline,
  canManageTeamDeadlines,
  DEADLINE_VISIBILITY_LABELS,
  getDeadlineWorkflowLabel,
  getDeadlineVisibilityBadgeClassName,
  getDeadlineWorkflowBadgeClassName,
  normalizeDeadlineVisibility,
  normalizeDeadlineWorkflowStatus,
} from "@/lib/deadline-access";
import { formatFileSize, getDeadlineDocumentFormatLabel } from "@/lib/deadline-documents";
import { getDeadlineDocumentByDeadlineId } from "@/lib/deadline-documents-server";
import { getDeadlineRenewalHistory } from "@/lib/renewal-history";
import type { DeadlineChecklistItem } from "@/lib/deadline-treatment";
import { getNextRecurringDate, getRecurrenceShortLabel, normalizeRecurrenceRule } from "@/lib/recurrence";
import {
  getDeadlineImportanceBadgeClassName,
  getDeadlineImportanceDescription,
  getDeadlineImportanceLabel,
  normalizeDeadlineImportance,
} from "@/lib/deadline-importance";
import { ensureUserOrganization } from "@/lib/organizations";
import { getAuthUserDisplayName } from "@/lib/user-display";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DeadlineDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Deadline = {
  id: number;
  title: string;
  category: string | null;
  due_date: string;
  notification_days: number[] | null;
  recurrence_rule: string | null;
  importance_level: string | null;
  treatment_note: string | null;
  useful_link_url: string | null;
  useful_link_label: string | null;
  created_at: string;
  user_id: string | null;
  organization_id: string | null;
  visibility: string | null;
  workflow_status: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  archived_by: string | null;
  archived_at: string | null;
};

type NotificationLog = {
  id: number;
  created_at: string;
  notification_day: number;
  due_date: string;
};

type StatusTone = "critical" | "urgent" | "warning" | "safe";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function parseLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    const fallbackDate = new Date(date);
    fallbackDate.setHours(0, 0, 0, 0);
    return fallbackDate;
  }

  return new Date(year, month - 1, day);
}

function getTodayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
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

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
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

function getStatusTone(daysUntilDeadline: number): StatusTone {
  if (daysUntilDeadline < 0) return "critical";
  if (daysUntilDeadline <= 7) return "urgent";
  if (daysUntilDeadline <= 30) return "warning";
  return "safe";
}

function getToneClasses(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    critical: "border-red-400/25 bg-red-400/10 text-red-100",
    urgent: "border-orange-400/25 bg-orange-400/10 text-orange-100",
    warning: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
    safe: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  };

  return classes[tone];
}

function getStatusInsight(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) {
    return {
      label: "Risque critique",
      title: "Cette échéance est en retard.",
      description:
        "Traitez-la en priorité pour limiter les risques de non-conformité, de pénalité ou d’interruption d’activité.",
    };
  }

  if (daysUntilDeadline === 0) {
    return {
      label: "Action immédiate",
      title: "Cette échéance arrive aujourd’hui.",
      description:
        "Vérifiez le document associé, finalisez l’action attendue et conservez une trace à jour.",
    };
  }

  if (daysUntilDeadline <= 7) {
    return {
      label: "Très proche",
      title: "Cette échéance demande une attention rapide.",
      description:
        "Il reste peu de temps pour traiter l’obligation. Priorisez les actions et les documents nécessaires.",
    };
  }

  if (daysUntilDeadline <= 30) {
    return {
      label: "À anticiper",
      title: "Cette échéance est identifiée dans le mois à venir.",
      description:
        "Vous avez encore de la marge, mais c’est le bon moment pour préparer les justificatifs et renouvellements.",
    };
  }

  return {
    label: "Sous contrôle",
    title: "Cette échéance est visible suffisamment en avance.",
    description:
      "Le suivi est sain. Gardez les rappels actifs pour rester alerté au bon moment.",
  };
}

function normalizeNotificationDays(days: number[] | null) {
  return Array.from(
    new Set(
      (days ?? [])
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 365)
    )
  ).sort((firstDay, secondDay) => secondDay - firstDay);
}

function formatReminder(day: number) {
  if (day === 0) return "Jour J";
  return `J-${day}`;
}

export default async function DeadlineDetailPage({
  params,
}: DeadlineDetailPageProps) {
  const { id } = await params;
  const deadlineId = Number(id);

  if (!Number.isInteger(deadlineId) || deadlineId <= 0) {
    notFound();
  }

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

  const { data: deadline, error } = await supabase
    .from("deadlines")
    .select("id, title, category, due_date, notification_days, recurrence_rule, importance_level, treatment_note, useful_link_url, useful_link_label, created_at, user_id, organization_id, visibility, workflow_status, claimed_by, claimed_at, completed_by, completed_at, archived_by, archived_at")
    .eq("id", deadlineId)
    .or(
      buildDeadlineAccessOrFilter({
        userId: user.id,
        organizationId: userOrganization?.organization.id,
      })
    )
    .maybeSingle();

  if (error) {
    console.error(error);

    return (
      <main className="min-h-screen bg-slate-950 px-5 py-6 text-white sm:px-8 sm:py-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/deadlines"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Retour aux échéances
          </Link>

          <div className="mt-8 rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
            <p className="text-lg font-bold">
              Impossible de charger cette échéance.
            </p>
            <p className="mt-2 text-sm leading-6 text-red-100/80">
              Réessayez dans quelques instants. Si le problème persiste,
              vérifiez que cette échéance existe toujours dans votre espace.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!deadline) {
    notFound();
  }

  const typedDeadline = deadline as Deadline;
  const today = getTodayAtMidnight();
  const daysUntilDeadline = getDaysUntilDeadline(typedDeadline.due_date, today);
  const statusTone = getStatusTone(daysUntilDeadline);
  const statusInsight = getStatusInsight(daysUntilDeadline);
  const normalizedNotificationDays = normalizeNotificationDays(
    typedDeadline.notification_days
  );
  const visibility = normalizeDeadlineVisibility(typedDeadline.visibility);
  const workflowStatus = normalizeDeadlineWorkflowStatus(typedDeadline.workflow_status);
  const visibilityLabel = DEADLINE_VISIBILITY_LABELS[visibility];
  const workflowLabel = getDeadlineWorkflowLabel({ status: workflowStatus, visibility });
  const organizationRole = userOrganization?.membership.role;
  const canManageTeam = canManageTeamDeadlines(organizationRole);
  const canContributeTeam = canContributeToTeamDeadlines(organizationRole);
  const canEditCurrentDeadline = canEditDeadline({
    visibility,
    ownerId: typedDeadline.user_id,
    userId: user.id,
    organizationRole,
    workflowStatus,
  });
  const canDeleteCurrentDeadline = canDeleteDeadline({
    visibility,
    ownerId: typedDeadline.user_id,
    userId: user.id,
    organizationRole,
  });
  const canEditDeadlineTreatmentOptions = canEditDeadlineTreatment({
    visibility,
    ownerId: typedDeadline.user_id,
    userId: user.id,
    organizationRole,
    workflowStatus,
    claimedBy: typedDeadline.claimed_by,
  });
  const isOwner = typedDeadline.user_id === user.id;
  const claimedByCurrentUser = typedDeadline.claimed_by === user.id;
  const completedByCurrentUser = typedDeadline.completed_by === user.id;
  const claimedByDisplayName = await getAuthUserDisplayName(typedDeadline.claimed_by);
  const completedByDisplayName = await getAuthUserDisplayName(typedDeadline.completed_by);

  const document = await getDeadlineDocumentByDeadlineId({
    supabase,
    userId: user.id,
    deadlineId: typedDeadline.id,
  });

  const { data: checklistItemsData, error: checklistItemsError } = await supabase
    .from("deadline_checklist_items")
    .select("id, deadline_id, title, is_completed, position, created_by, completed_by, completed_at, created_at, updated_at")
    .eq("deadline_id", typedDeadline.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (checklistItemsError) {
    console.error(checklistItemsError);
  }

  const checklistItems = checklistItemsError
    ? []
    : ((checklistItemsData ?? []) as DeadlineChecklistItem[]);

  const { data: notificationLogs, error: notificationLogsError } = await supabase
    .from("notification_logs")
    .select("id, created_at, notification_day, due_date")
    .eq("deadline_id", typedDeadline.id)
    .order("created_at", { ascending: false })
    .limit(8)
    .returns<NotificationLog[]>();

  if (notificationLogsError) {
    console.error(notificationLogsError);
  }

  const logs = notificationLogsError ? [] : notificationLogs ?? [];
  const activityLogs = await getDeadlineActivityLogs({
    supabase,
    userId: user.id,
    deadlineId: typedDeadline.id,
    limit: 40,
  });
  const renewalHistory = await getDeadlineRenewalHistory({
    supabase,
    userId: user.id,
    deadlineId: typedDeadline.id,
    limit: 30,
  });

  const formattedDueDate = formatDeadlineDate(typedDeadline.due_date);
  const formattedCreatedAt = formatDateTime(typedDeadline.created_at);
  const categoryLabel = typedDeadline.category?.trim() || "Sans catégorie";
  const recurrenceRule = normalizeRecurrenceRule(typedDeadline.recurrence_rule);
  const recurrenceLabel = getRecurrenceShortLabel(recurrenceRule);
  const nextRecurringDate = getNextRecurringDate(typedDeadline.due_date, recurrenceRule);
  const reminderCount = normalizedNotificationDays.length;
  const importanceLevel = normalizeDeadlineImportance(typedDeadline.importance_level);
  const importanceLabel = getDeadlineImportanceLabel(importanceLevel);

  const keyMetrics = [
    {
      label: "Échéance",
      value: getCompactStatus(daysUntilDeadline),
      helper: getReadableStatus(daysUntilDeadline),
      className: getToneClasses(statusTone),
    },
    {
      label: "Rappels actifs",
      value: reminderCount,
      helper:
        reminderCount > 0
          ? normalizedNotificationDays.map(formatReminder).join(" · ")
          : "Aucun rappel configuré",
      className: "border-blue-400/25 bg-blue-400/10 text-blue-100",
    },
    {
      label: "Importance",
      value: importanceLabel,
      helper: getDeadlineImportanceDescription(importanceLevel),
      className: getDeadlineImportanceBadgeClassName(importanceLevel),
    },
    {
      label: "Document",
      value: document ? "1" : "0",
      helper: document ? `${getDeadlineDocumentFormatLabel(document.mime_type, document.file_name)} associé` : "Aucun document joint",
      className: document
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
        : "border-white/10 bg-white/[0.03] text-slate-200",
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/deadlines"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-blue-200 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Retour aux échéances
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={`/deadlines/${typedDeadline.id}/report`}
              className="inline-flex justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-400/15 hover:text-white"
            >
              Rapport PDF
            </Link>
            {canDeleteCurrentDeadline || canEditCurrentDeadline ? (
              <>
                {canEditCurrentDeadline ? (
                  <Link
                    href={`/deadlines/edit/${typedDeadline.id}?returnTo=detail`}
                    className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                  >
                    Modifier
                  </Link>
                ) : null}
                {canDeleteCurrentDeadline ? (
                  <DeleteDeadlineButton
                    id={typedDeadline.id}
                    title={typedDeadline.title}
                    category={typedDeadline.category}
                    documentFilePath={document?.file_path}
                    redirectTo="/deadlines"
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </header>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
Fiche échéance
                </div>

                <h1 className="mt-5 max-w-4xl break-words text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {typedDeadline.title}
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Statut, document, rappels et historique regroupés au même endroit.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {categoryLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {formattedDueDate}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    Créée le {formattedCreatedAt}
                  </span>
                  <span className={`rounded-full border px-3 py-1 ${getDeadlineVisibilityBadgeClassName(visibility)}`}>
                    {visibilityLabel}
                  </span>
                  <span className={`rounded-full border px-3 py-1 ${getDeadlineWorkflowBadgeClassName(workflowStatus)}`}>
                    {workflowLabel}
                  </span>
                  <span className={`rounded-full border px-3 py-1 ${getDeadlineImportanceBadgeClassName(importanceLevel)}`}>
                    Importance : {importanceLabel}
                  </span>
                </div>
              </div>

              <div className={`rounded-3xl border p-5 ${getToneClasses(statusTone)}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                  {statusInsight.label}
                </p>
                <h2 className="mt-4 text-2xl font-bold text-white">
                  {statusInsight.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-200/80">
                  {statusInsight.description}
                </p>
                <span className="mt-5 inline-flex rounded-full border border-white/15 bg-slate-950/25 px-3 py-1 text-xs font-semibold text-white">
                  {getReadableStatus(daysUntilDeadline)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-4">
          {keyMetrics.map((metric) => (
            <div
              key={metric.label}
              className={`rounded-3xl border p-5 shadow-xl shadow-slate-950/20 ${metric.className}`}
            >
              <p className="text-sm font-medium opacity-80">{metric.label}</p>
              <p className="mt-4 text-5xl font-bold text-white">{metric.value}</p>
              <p className="mt-3 text-sm leading-6 opacity-80">{metric.helper}</p>
            </div>
          ))}
        </section>

        <section className={`mt-6 rounded-[2rem] border p-6 shadow-2xl shadow-slate-950/20 sm:p-7 ${
          visibility === "team"
            ? "border-cyan-400/20 bg-cyan-400/10"
            : "border-violet-400/20 bg-violet-400/10"
        }`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                {visibility === "team" ? "Suivi équipe" : "Suivi personnel"}
              </div>
              <h2 className="mt-4 text-2xl font-bold text-white">
                {visibility === "team" ? "Qui travaille sur cette échéance ?" : "Où en est cette échéance ?"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-100/80">
                {visibility === "team"
                  ? "Les membres peuvent indiquer qu’ils s’en occupent ou que l’action est faite. Les administrateurs valident ensuite pour déplacer l’échéance dans l’historique."
                  : "Vous pouvez marquer cette échéance comme en cours, puis comme faite. Une échéance personnelle faite part directement dans l’historique."}
              </p>
            </div>
            <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getDeadlineWorkflowBadgeClassName(workflowStatus)}`}>
              {workflowLabel}
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">En cours par</p>
              <p className="mt-2 font-semibold text-white">
                {claimedByDisplayName ?? "Personne pour le moment"}
              </p>
              {typedDeadline.claimed_at ? (
                <p className="mt-1 text-xs text-slate-300/70">{formatDateTime(typedDeadline.claimed_at)}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Faite par</p>
              <p className="mt-2 font-semibold text-white">
                {completedByDisplayName ?? "Pas encore indiquée comme faite"}
              </p>
              {typedDeadline.completed_at ? (
                <p className="mt-1 text-xs text-slate-300/70">{formatDateTime(typedDeadline.completed_at)}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <TeamDeadlineWorkflowActions
              deadlineId={typedDeadline.id}
              status={workflowStatus}
              visibility={visibility}
              canContribute={canContributeTeam}
              canManage={canManageTeam}
              isOwner={isOwner}
              claimedByCurrentUser={claimedByCurrentUser}
              completedByCurrentUser={completedByCurrentUser}
            />
          </div>
        </section>



        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Informations clés
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Les données principales utilisées par le cockpit et les
                    rappels automatiques.
                  </p>
                </div>
                {canEditCurrentDeadline ? (
                  <Link
                    href={`/deadlines/edit/${typedDeadline.id}?returnTo=detail`}
                    className="inline-flex justify-center rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
                  >
                    Modifier l’échéance
                  </Link>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Catégorie
                  </p>
                  <p className="mt-2 font-semibold text-slate-100">
                    {categoryLabel}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Date d’échéance
                  </p>
                  <p className="mt-2 font-semibold text-slate-100">
                    {formattedDueDate}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Statut
                  </p>
                  <p className="mt-2 font-semibold text-slate-100">
                    {getReadableStatus(daysUntilDeadline)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Importance
                  </p>
                  <p className="mt-2 font-semibold text-slate-100">
                    {importanceLabel}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Ajoutée
                  </p>
                  <p className="mt-2 font-semibold text-slate-100">
                    {formattedCreatedAt}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Portée
                  </p>
                  <p className="mt-2 font-semibold text-slate-100">
                    {visibilityLabel}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Suivi équipe
                  </p>
                  <p className="mt-2 font-semibold text-slate-100">
                    {visibility === "team" ? workflowLabel : "Non partagé"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Récurrence
                  </p>
                  <p className="mt-2 font-semibold text-slate-100">
                    {recurrenceLabel}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {nextRecurringDate
                      ? `Prochaine date suggérée au renouvellement : ${formatDeadlineDate(nextRecurringDate)}`
                      : "Aucune date automatique ne sera proposée au renouvellement."}
                  </p>
                </div>
              </div>
            </section>

          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Document associé
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Le justificatif ou fichier lié à cette obligation.
                  </p>
                </div>
                <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xl">
                  {document ? getDeadlineDocumentFormatLabel(document.mime_type, document.file_name) : "Doc"}
                </span>
              </div>

              {document ? (
                <div className="mt-6 rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5">
                  <p className="break-words text-lg font-bold text-white">
                    {document.file_name}
                  </p>
                  <p className="mt-2 text-sm text-blue-100/80">
                    {formatFileSize(document.file_size)} · fichier sécurisé
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <Link
                      href={`/deadlines/documents/${document.id}`}
                      className="inline-flex justify-center rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
                    >
                      Voir le document
                    </Link>
                    <a
                      href={`/api/deadline-documents/${document.id}?download=1`}
                      className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                    >
                      Télécharger
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-5">
                  <p className="font-semibold text-white">Aucun document joint.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Ajoutez une attestation, un contrat, un certificat ou une image depuis la modification de l’échéance.
                  </p>
                  {canEditCurrentDeadline ? (
                    <Link
                      href={`/deadlines/edit/${typedDeadline.id}?returnTo=detail`}
                      className="mt-5 inline-flex justify-center rounded-xl border border-blue-400/25 bg-blue-400/10 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white"
                    >
                      Ajouter un document
                    </Link>
                  ) : null}
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Journal d’activité
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Les dernières actions enregistrées sur cette échéance.
                </p>
              </div>

              <div className="mt-6">
                <ActivityLogList logs={activityLogs} />
              </div>
            </section>

          </aside>
        </section>

        <DeadlineTreatmentPanel
          deadlineId={typedDeadline.id}
          checklistItems={checklistItems}
          treatmentNote={typedDeadline.treatment_note}
          usefulLinkUrl={typedDeadline.useful_link_url}
          usefulLinkLabel={typedDeadline.useful_link_label}
          canEdit={canEditDeadlineTreatmentOptions}
        />

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Rappels configurés
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Les notifications automatiques prévues pour cette échéance.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">
                  {reminderCount} rappel{reminderCount > 1 ? "s" : ""}
                </span>
              </div>

              {reminderCount > 0 ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {normalizedNotificationDays.map((day) => (
                    <span
                      key={day}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100"
                    >
                      {formatReminder(day)}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
                  Aucun rappel spécifique n’est configuré pour cette échéance.
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Historique notifications
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Les derniers rappels envoyés pour cette échéance.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold text-slate-100">
                          Rappel {formatReminder(log.notification_day)}
                        </p>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                          Envoyé
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        {formatDateTime(log.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Échéance ciblée : {formatDeadlineDate(log.due_date)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="font-semibold text-white">
                      Aucun rappel envoyé pour le moment.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Les futurs envois apparaîtront ici automatiquement lorsque
                      le cron quotidien déclenchera les notifications prévues.
                    </p>
                  </div>
                )}
              </div>
            </section>

          </div>

          <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Historique des renouvellements
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Les cycles clôturés restent archivés avec l’ancienne date, la
                nouvelle échéance et le document concerné.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              {renewalHistory.length} renouvellement
              {renewalHistory.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-6">
            <RenewalHistoryList renewals={renewalHistory} />
          </div>
          </section>
        </section>

        {canEditCurrentDeadline ? (
          <RenewDeadlineForm
            deadline={{
            id: typedDeadline.id,
            title: typedDeadline.title,
            category: typedDeadline.category,
            due_date: typedDeadline.due_date,
            notification_days: typedDeadline.notification_days,
            recurrence_rule: typedDeadline.recurrence_rule,
          }}
            document={document}
          />
        ) : null}
      </div>
    </main>
  );
}
