import Link from "next/link";
import { redirect } from "next/navigation";
import AdminNavigation from "@/components/AdminNavigation";
import AppHeader from "@/components/AppHeader";
import { ensureUserOrganization } from "@/lib/organizations";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserDisplayName } from "@/lib/user-display";
import { isUserAdmin } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

type WeeklySummaryLog = {
  id: string;
  created_at: string | null;
  user_id: string | null;
  week_start: string | null;
  email: string | null;
  status: string | null;
  sent_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

type NotificationLog = {
  id: string;
  created_at: string | null;
  deadline_id: number | null;
  user_id: string | null;
  notification_day: number | null;
  due_date: string | null;
};

const weeklyCronEndpoint = "/api/cron/send-weekly-summary";
const dailyCronEndpoint = "/api/cron/send-notifications";

function formatDateTime(date: string | null | undefined) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function getStatusClassName(status: string | null | undefined) {
  if (status === "sent") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  if (status === "failed") return "border-red-400/20 bg-red-400/10 text-red-100";
  if (status === "pending") return "border-yellow-400/20 bg-yellow-400/10 text-yellow-100";

  return "border-slate-400/20 bg-slate-400/10 text-slate-200";
}

function getStatusLabel(status: string | null | undefined) {
  if (status === "sent") return "Envoyé";
  if (status === "failed") return "Échec";
  if (status === "pending") return "Réservé";

  return status || "Inconnu";
}

function getEnvStatusClassName(isConfigured: boolean) {
  return isConfigured
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
    : "border-red-400/20 bg-red-400/10 text-red-100";
}

function getMetricValue(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];

  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return value;

  return "—";
}

async function getExactCount(
  table: string,
  buildQuery?: (query: any) => any
) {
  let query = supabaseAdmin.from(table).select("*", {
    count: "exact",
    head: true,
  });

  if (buildQuery) {
    query = buildQuery(query);
  }

  const { count, error } = await query;

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export default async function AdminCronPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  if (!(await isUserAdmin(user.id))) {
    redirect("/dashboard");
  }

  const userOrganization = await ensureUserOrganization({
    userId: user.id,
    email: user.email,
  });
  const displayName = getUserDisplayName(user);

  const [
    optInUsersCount,
    weeklyLogsCount,
    sentWeeklyLogsCount,
    failedWeeklyLogsCount,
    notificationLogsCount,
    weeklyLogsResult,
    notificationLogsResult,
  ] = await Promise.all([
    getExactCount("user_notification_preferences", (query) =>
      query.eq("weekly_summary_enabled", true)
    ),
    getExactCount("weekly_summary_logs"),
    getExactCount("weekly_summary_logs", (query) => query.eq("status", "sent")),
    getExactCount("weekly_summary_logs", (query) => query.eq("status", "failed")),
    getExactCount("notification_logs"),
    supabaseAdmin
      .from("weekly_summary_logs")
      .select("id, created_at, user_id, week_start, email, status, sent_at, error_message, metadata")
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<WeeklySummaryLog[]>(),
    supabaseAdmin
      .from("notification_logs")
      .select("id, created_at, deadline_id, user_id, notification_day, due_date")
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<NotificationLog[]>(),
  ]);

  const weeklyLogsUnavailable = Boolean(weeklyLogsResult.error);
  const notificationLogsUnavailable = Boolean(notificationLogsResult.error);
  const weeklyLogs = weeklyLogsResult.data ?? [];
  const notificationLogs = notificationLogsResult.data ?? [];
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET);
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.duepilot.fr";
  const weeklyCronUrl = `${appUrl}${weeklyCronEndpoint}`;
  const weeklyDryRunUrl = `${weeklyCronUrl}?dryRun=1`;

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader
          subtitle="Administration cron"
          userName={displayName}
          userEmail={user.email}
          organizationName={userOrganization?.organization.name}
          organizationRole={userOrganization?.membership.role}
          isAdminUser
          active="admin"
        />

        <AdminNavigation active="cron" />

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.85fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                  Production
                </div>
                <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Cron & emails automatiques
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Vérifiez la configuration des tâches planifiées DuePilot, les derniers envois et le niveau d’activation du résumé hebdomadaire.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Résumé hebdomadaire
                </p>
                <p className="mt-4 text-5xl font-bold tracking-tight text-white">
                  {optInUsersCount}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  utilisateur{optInUsersCount > 1 ? "s" : ""} opt-in. Aucun email hebdomadaire n’est envoyé aux comptes qui n’ont pas activé l’option.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
            <p className="text-sm font-semibold text-slate-400">Opt-in hebdomadaire</p>
            <p className="mt-4 text-4xl font-bold text-white">{optInUsersCount}</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">Préférences activées dans Mon compte.</p>
          </div>
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl shadow-slate-950/20">
            <p className="text-sm font-semibold text-emerald-100">Résumés envoyés</p>
            <p className="mt-4 text-4xl font-bold text-white">{sentWeeklyLogsCount}</p>
            <p className="mt-3 text-sm leading-6 text-emerald-100/80">Sur {weeklyLogsCount} log{weeklyLogsCount > 1 ? "s" : ""} hebdomadaire{weeklyLogsCount > 1 ? "s" : ""}.</p>
          </div>
          <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-5 shadow-xl shadow-slate-950/20">
            <p className="text-sm font-semibold text-red-100">Échecs hebdo</p>
            <p className="mt-4 text-4xl font-bold text-white">{failedWeeklyLogsCount}</p>
            <p className="mt-3 text-sm leading-6 text-red-100/80">À surveiller si un envoi échoue.</p>
          </div>
          <div className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 shadow-xl shadow-slate-950/20">
            <p className="text-sm font-semibold text-blue-100">Rappels quotidiens</p>
            <p className="mt-4 text-4xl font-bold text-white">{notificationLogsCount}</p>
            <p className="mt-3 text-sm leading-6 text-blue-100/80">Logs existants des notifications d’échéances.</p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <h2 className="text-2xl font-bold text-white">Configuration active</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Cette page ne révèle aucune clé. Elle confirme uniquement si les variables nécessaires sont présentes côté serveur.
            </p>

            <div className="mt-6 space-y-3">
              <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${getEnvStatusClassName(cronSecretConfigured)}`}>
                CRON_SECRET : {cronSecretConfigured ? "configuré" : "manquant"}
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${getEnvStatusClassName(resendConfigured)}`}>
                RESEND_API_KEY : {resendConfigured ? "configuré" : "manquant"}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
                NEXT_PUBLIC_APP_URL : <span className="break-all font-semibold text-white">{appUrl}</span>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5">
              <h3 className="font-bold text-white">Routes protégées</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-blue-100/85">
                <p className="break-all"><span className="font-semibold text-white">Quotidien :</span> {dailyCronEndpoint}</p>
                <p className="break-all"><span className="font-semibold text-white">Hebdomadaire :</span> {weeklyCronEndpoint}</p>
              </div>
              <p className="mt-4 text-xs leading-5 text-blue-100/70">
                Les routes refusent les appels sans header Authorization: Bearer CRON_SECRET.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <h2 className="text-2xl font-bold text-white">Mise en production</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Comme le fichier vercel.json n’est pas dans le ZIP src, la planification reste à configurer côté projet Vercel ou dans ton vercel.json réel.
            </p>

            <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Planning recommandé
              </p>
              <p className="mt-3 text-lg font-bold text-white">Chaque lundi matin</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Exemple cron UTC : <code className="rounded-lg bg-white/10 px-2 py-1 text-blue-100">0 7 * * 1</code>. Cela lance le résumé une fois par semaine, le lundi.
              </p>
            </div>

            <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Test sans envoi
              </p>
              <p className="mt-3 break-all text-sm font-semibold text-white">{weeklyDryRunUrl}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Ajoute le header Authorization avec ton CRON_SECRET. Le mode dryRun vérifie les utilisateurs opt-in et les échéances, sans envoyer d’email et sans réserver de log hebdomadaire.
              </p>
            </div>

            <div className="mt-5 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
              <h3 className="font-bold text-white">Anti-doublon actif</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-100/85">
                Le résumé hebdomadaire reste protégé par un log unique par utilisateur et par semaine. Si la tâche est rejouée, les comptes déjà envoyés ou réservés sont ignorés.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Derniers résumés hebdomadaires</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Les derniers logs de la table weekly_summary_logs.
                </p>
              </div>
              <Link
                href="/settings/account"
                className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-blue-400/30 hover:bg-blue-400/10"
              >
                Voir l’option côté compte
              </Link>
            </div>

            {weeklyLogsUnavailable ? (
              <div className="mt-6 rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-sm leading-6 text-yellow-100">
                Les logs hebdomadaires ne sont pas disponibles pour le moment. La configuration cron reste consultable.
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {weeklyLogs.length > 0 ? (
                weeklyLogs.map((log) => (
                  <article key={log.id} className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-all text-sm font-bold text-white">{log.email || "Email indisponible"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Semaine du {formatDate(log.week_start)} · Créé le {formatDateTime(log.created_at)}
                        </p>
                      </div>
                      <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${getStatusClassName(log.status)}`}>
                        {getStatusLabel(log.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-3">
                      <span>Actives : {getMetricValue(log.metadata, "active_count")}</span>
                      <span>Retard : {getMetricValue(log.metadata, "overdue_count")}</span>
                      <span>J+7 : {getMetricValue(log.metadata, "next_7_days_count")}</span>
                      <span>J+30 : {getMetricValue(log.metadata, "next_30_days_count")}</span>
                      <span>Validation : {getMetricValue(log.metadata, "pending_validation_count")}</span>
                      <span>Critiques : {getMetricValue(log.metadata, "critical_count")}</span>
                    </div>

                    {log.error_message ? (
                      <p className="mt-4 break-words rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs leading-5 text-red-100">
                        {log.error_message}
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-6 text-sm leading-6 text-slate-400">
                  Aucun log hebdomadaire pour le moment.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <h2 className="text-2xl font-bold text-white">Derniers rappels quotidiens</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Aperçu rapide des derniers emails de rappel d’échéance.
            </p>

            {notificationLogsUnavailable ? (
              <div className="mt-6 rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-sm leading-6 text-yellow-100">
                Les logs de rappels quotidiens ne sont pas disponibles pour le moment.
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {notificationLogs.length > 0 ? (
                notificationLogs.map((log) => (
                  <article key={log.id} className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">
                          Échéance #{log.deadline_id ?? "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Créé le {formatDateTime(log.created_at)}
                        </p>
                      </div>
                      <span className="inline-flex w-fit rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-100">
                        J-{log.notification_day ?? "—"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-400">
                      Date échéance : {formatDate(log.due_date)}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-6 text-sm leading-6 text-slate-400">
                  Aucun rappel quotidien journalisé pour le moment.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
