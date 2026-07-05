import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PrintReportButton from "@/components/PrintReportButton";
import { getDeadlineActivityLogs } from "@/lib/activity-logs";
import {
  buildDeadlineAccessOrFilter,
  DEADLINE_VISIBILITY_LABELS,
  getDeadlineWorkflowLabel,
  normalizeDeadlineVisibility,
  normalizeDeadlineWorkflowStatus,
} from "@/lib/deadline-access";
import { formatFileSize } from "@/lib/deadline-documents";
import { getDeadlineDocumentByDeadlineId } from "@/lib/deadline-documents-server";
import { getDeadlineRenewalHistory } from "@/lib/renewal-history";
import { getRecurrenceShortLabel } from "@/lib/recurrence";
import { getDeadlineImportanceLabel } from "@/lib/deadline-importance";
import { ensureUserOrganization } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DeadlineReportPageProps = {
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
  created_at: string;
  user_id: string | null;
  organization_id: string | null;
  visibility: string | null;
  workflow_status: string | null;
};

type NotificationLog = {
  id: number;
  created_at: string;
  notification_day: number;
  due_date: string;
};

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

  if (daysUntilDeadline === 0) return "À traiter aujourd’hui";
  if (daysUntilDeadline === 1) return "À traiter demain";

  return `Dans ${daysUntilDeadline} jours`;
}

function getStatusLabel(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) return "Échéance en retard";
  if (daysUntilDeadline <= 7) return "Action prioritaire";
  if (daysUntilDeadline <= 30) return "À anticiper";
  return "Sous contrôle";
}

function formatReminder(day: number) {
  if (day === 0) return "Jour J";
  return `J-${day}`;
}

function normalizeNotificationDays(days: number[] | null) {
  if (!Array.isArray(days)) return [];

  return [...new Set(days)]
    .filter((day) => Number.isInteger(day) && day >= 0)
    .sort((firstDay, secondDay) => secondDay - firstDay);
}

function getDocumentActionLabel(action: string) {
  if (action === "kept") return "Document conservé";
  if (action === "added") return "Document ajouté";
  if (action === "replaced") return "Document remplacé";
  if (action === "removed") return "Document supprimé";
  return "Aucune modification document";
}

function getActivityLabel(action: string) {
  if (action === "deadline.created") return "Échéance créée";
  if (action === "deadline.updated") return "Échéance modifiée";
  if (action === "deadline.deleted") return "Échéance supprimée";
  if (action === "deadline.title_updated") return "Nom modifié";
  if (action === "deadline.category_updated") return "Catégorie modifiée";
  if (action === "deadline.due_date_updated") return "Date modifiée";
  if (action === "deadline.reminders_updated") return "Rappels modifiés";
  if (action === "deadline.recurrence_updated") return "Récurrence modifiée";
  if (action === "deadline.renewed") return "Échéance renouvelée";
  if (action === "deadline.claimed") return "Échéance prise en charge";
  if (action === "deadline.completed") return "Échéance faite, à valider";
  if (action === "deadline.personal_completed") return "Échéance personnelle archivée";
  if (action === "deadline.validated") return "Échéance validée";
  if (action === "deadline.unclaimed") return "Prise en charge annulée";
  if (action === "deadline.reopened") return "Échéance remise à traiter";
  if (action === "document.added") return "Document ajouté";
  if (action === "document.replaced") return "Document remplacé";
  if (action === "document.removed") return "Document supprimé";
  if (action === "notification.sent") return "Notification envoyée";
  return "Activité";
}

export default async function DeadlineReportPage({
  params,
}: DeadlineReportPageProps) {
  const supabase = await createClient();
  const resolvedParams = await params;
  const deadlineId = Number(resolvedParams.id);

  if (!Number.isInteger(deadlineId) || deadlineId <= 0) {
    notFound();
  }

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
    .select("id, title, category, due_date, notification_days, recurrence_rule, importance_level, created_at, user_id, organization_id, visibility, workflow_status")
    .eq("id", deadlineId)
    .or(
      buildDeadlineAccessOrFilter({
        userId: user.id,
        organizationId: userOrganization?.organization.id,
      })
    )
    .maybeSingle()
    .returns<Deadline | null>();

  if (error) {
    console.error(error);
    redirect("/deadlines");
  }

  if (!deadline) {
    notFound();
  }

  const typedDeadline = deadline as Deadline;
  const visibility = normalizeDeadlineVisibility(typedDeadline.visibility);
  const workflowStatus = normalizeDeadlineWorkflowStatus(typedDeadline.workflow_status);
  const visibilityLabel = DEADLINE_VISIBILITY_LABELS[visibility];
  const workflowLabel = getDeadlineWorkflowLabel({ status: workflowStatus, visibility });
  const document = await getDeadlineDocumentByDeadlineId({
    supabase,
    userId: user.id,
    deadlineId: typedDeadline.id,
  });

  const { data: notificationLogs, error: notificationLogsError } = await supabase
    .from("notification_logs")
    .select("id, created_at, notification_day, due_date")
    .eq("deadline_id", typedDeadline.id)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<NotificationLog[]>();

  if (notificationLogsError) {
    console.error(notificationLogsError);
  }

  const activityLogs = await getDeadlineActivityLogs({
    supabase,
    userId: user.id,
    deadlineId: typedDeadline.id,
    limit: 12,
  });
  const renewalHistory = await getDeadlineRenewalHistory({
    supabase,
    userId: user.id,
    deadlineId: typedDeadline.id,
    limit: 12,
  });
  const notificationDays = normalizeNotificationDays(
    typedDeadline.notification_days
  );
  const today = getTodayAtMidnight();
  const daysUntilDeadline = getDaysUntilDeadline(typedDeadline.due_date, today);
  const generatedAt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const categoryLabel = typedDeadline.category?.trim() || "Sans catégorie";
  const recurrenceLabel = getRecurrenceShortLabel(typedDeadline.recurrence_rule);
  const importanceLabel = getDeadlineImportanceLabel(typedDeadline.importance_level);
  const logs = notificationLogsError ? [] : notificationLogs ?? [];

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-slate-950 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-3 text-white print:hidden sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/deadlines/${typedDeadline.id}`}
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-blue-200 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Retour à la fiche
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrintReportButton />
            <Link
              href="/deadlines"
              className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
            >
              Toutes les échéances
            </Link>
          </div>
        </header>

        <article className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-950/30 print:rounded-none print:shadow-none">
          <section className="border-b border-slate-200 bg-slate-950 px-7 py-8 text-white print:bg-white print:px-0 print:py-0 print:text-slate-950">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200 print:text-slate-500">
                  Rapport DuePilot
                </p>
                <h1 className="mt-4 max-w-3xl break-words text-4xl font-bold tracking-tight print:text-3xl">
                  {typedDeadline.title}
                </h1>
                <p className="mt-3 text-sm text-slate-300 print:text-slate-600">
                  Rapport généré le {generatedAt}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 print:border-slate-200 print:bg-slate-50">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 print:text-slate-500">
                  Statut
                </p>
                <p className="mt-2 text-lg font-bold print:text-slate-950">
                  {getStatusLabel(daysUntilDeadline)}
                </p>
                <p className="mt-1 text-sm text-slate-300 print:text-slate-600">
                  {getReadableStatus(daysUntilDeadline)}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 border-b border-slate-200 px-7 py-6 sm:grid-cols-2 lg:grid-cols-6 print:px-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Catégorie
              </p>
              <p className="mt-2 font-semibold text-slate-950">{categoryLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Date d’échéance
              </p>
              <p className="mt-2 font-semibold text-slate-950">
                {formatDeadlineDate(typedDeadline.due_date)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Rappels
              </p>
              <p className="mt-2 font-semibold text-slate-950">
                {notificationDays.length > 0
                  ? notificationDays.map(formatReminder).join(" · ")
                  : "Aucun rappel"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Portée
              </p>
              <p className="mt-2 font-semibold text-slate-950">{visibilityLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Suivi équipe
              </p>
              <p className="mt-2 font-semibold text-slate-950">
                {visibility === "team" ? workflowLabel : "Non partagé"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Récurrence
              </p>
              <p className="mt-2 font-semibold text-slate-950">
                {recurrenceLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Importance
              </p>
              <p className="mt-2 font-semibold text-slate-950">
                {importanceLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Créée le
              </p>
              <p className="mt-2 font-semibold text-slate-950">
                {formatDateTime(typedDeadline.created_at)}
              </p>
            </div>
          </section>

          <section className="grid gap-6 border-b border-slate-200 px-7 py-7 lg:grid-cols-[0.9fr_1.1fr] print:px-0">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Document associé</h2>
              {document ? (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="break-words font-semibold text-slate-950">
                    {document.file_name}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatFileSize(document.file_size)} · PDF sécurisé
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Aucun document PDF n’est associé à cette échéance.
                </p>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Derniers rappels envoyés
              </h2>
              <div className="mt-4 space-y-3">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="font-semibold text-slate-950">
                        Rappel {formatReminder(log.notification_day)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Envoyé le {formatDateTime(log.created_at)} · échéance ciblée : {formatDeadlineDate(log.due_date)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Aucun rappel envoyé pour le moment.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="border-b border-slate-200 px-7 py-7 print:px-0">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">
                Historique des renouvellements
              </h2>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {renewalHistory.length} renouvellement
                {renewalHistory.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {renewalHistory.length > 0 ? (
                renewalHistory.map((renewal) => (
                  <div
                    key={renewal.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Ancienne date
                        </p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {formatDeadlineDate(renewal.previous_due_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Nouvelle date
                        </p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {formatDeadlineDate(renewal.new_due_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Document
                        </p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {getDocumentActionLabel(renewal.document_action)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      Renouvelé le {formatDateTime(renewal.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Aucun renouvellement archivé pour cette échéance.
                </p>
              )}
            </div>
          </section>

          <section className="px-7 py-7 print:px-0">
            <h2 className="text-xl font-bold text-slate-950">Journal d’activité</h2>
            <div className="mt-4 space-y-3">
              {activityLogs.length > 0 ? (
                activityLogs.map((activityLog) => (
                  <div
                    key={activityLog.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="font-semibold text-slate-950">
                      {getActivityLabel(activityLog.action)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {activityLog.description || activityLog.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(activityLog.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Aucune activité enregistrée pour le moment.
                </p>
              )}
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
