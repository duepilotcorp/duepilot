import Link from "next/link";
import { redirect } from "next/navigation";
import AdminNavigation from "@/components/AdminNavigation";
import AppHeader from "@/components/AppHeader";
import { BETA_ACCESS_STATUSES, type BetaAccessStatus } from "@/lib/beta-access-admin";
import { ensureUserOrganization } from "@/lib/organizations";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserDisplayName } from "@/lib/user-display";
import { isUserAdmin } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

async function getExactCount(table: string, buildQuery?: (query: any) => any) {
  let query = supabaseAdmin.from(table).select("*", {
    count: "exact",
    head: true,
  });

  if (buildQuery) {
    query = buildQuery(query);
  }

  const { count, error } = await query;

  if (error) {
    console.error(error);
    return 0;
  }

  return count ?? 0;
}

function getBetaStatusTone(status: BetaAccessStatus) {
  const tones: Record<BetaAccessStatus, string> = {
    new: "border-blue-400/20 bg-blue-400/10 text-blue-100",
    contacted: "border-yellow-400/20 bg-yellow-400/10 text-yellow-100",
    accepted: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    rejected: "border-slate-400/20 bg-slate-400/10 text-slate-200",
  };

  return tones[status];
}

export default async function AdminPage() {
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
    totalBetaRequests,
    newBetaRequests,
    contactedBetaRequests,
    acceptedBetaRequests,
    rejectedBetaRequests,
    optInUsersCount,
    sentWeeklyLogsCount,
    failedWeeklyLogsCount,
    recentBetaRequestsResult,
    recentWeeklyLogsResult,
  ] = await Promise.all([
    getExactCount("beta_access_requests"),
    getExactCount("beta_access_requests", (query) => query.eq("status", "new")),
    getExactCount("beta_access_requests", (query) => query.eq("status", "contacted")),
    getExactCount("beta_access_requests", (query) => query.eq("status", "accepted")),
    getExactCount("beta_access_requests", (query) => query.eq("status", "rejected")),
    getExactCount("user_notification_preferences", (query) =>
      query.eq("weekly_summary_enabled", true)
    ),
    getExactCount("weekly_summary_logs", (query) => query.eq("status", "sent")),
    getExactCount("weekly_summary_logs", (query) => query.eq("status", "failed")),
    supabaseAdmin
      .from("beta_access_requests")
      .select("id, created_at, full_name, email, company, status")
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("weekly_summary_logs")
      .select("id, created_at, email, status, error_message")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (recentBetaRequestsResult.error) {
    console.error(recentBetaRequestsResult.error);
  }

  if (recentWeeklyLogsResult.error) {
    console.error(recentWeeklyLogsResult.error);
  }

  const betaCounts: Record<BetaAccessStatus, number> = {
    new: newBetaRequests,
    contacted: contactedBetaRequests,
    accepted: acceptedBetaRequests,
    rejected: rejectedBetaRequests,
  };

  const recentBetaRequests = recentBetaRequestsResult.data ?? [];
  const recentWeeklyLogs = recentWeeklyLogsResult.data ?? [];
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET);
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader
          subtitle="Administration"
          userName={displayName}
          userEmail={user.email}
          organizationName={userOrganization?.organization.name}
          organizationRole={userOrganization?.membership.role}
          isAdminUser
          active="admin"
        />

        <AdminNavigation active="overview" />

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.3fr_0.75fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-purple-100">
                  Centre de pilotage
                </div>
                <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Administration DuePilot
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Un panneau unique pour suivre la beta privée, contrôler les emails automatiques et piloter les réglages sensibles sans alourdir le menu utilisateur.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  À traiter
                </p>
                <p className="mt-4 text-5xl font-bold tracking-tight text-white">
                  {newBetaRequests}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  nouvelle{newBetaRequests > 1 ? "s" : ""} demande{newBetaRequests > 1 ? "s" : ""} beta en attente de qualification.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/admin/beta-requests"
            className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:border-blue-300/35 hover:bg-blue-400/15"
          >
            <p className="text-sm font-semibold text-blue-100">Demandes beta</p>
            <p className="mt-4 text-4xl font-bold text-white">{totalBetaRequests}</p>
            <p className="mt-3 text-sm leading-6 text-blue-100/80">File complète des demandes d’accès.</p>
          </Link>

          <Link
            href="/admin/beta-requests"
            className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-emerald-400/15"
          >
            <p className="text-sm font-semibold text-emerald-100">Accès validés</p>
            <p className="mt-4 text-4xl font-bold text-white">{acceptedBetaRequests}</p>
            <p className="mt-3 text-sm leading-6 text-emerald-100/80">Comptes beta acceptés depuis le panneau.</p>
          </Link>

          <Link
            href="/admin/cron"
            className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-400/15"
          >
            <p className="text-sm font-semibold text-cyan-100">Opt-in hebdo</p>
            <p className="mt-4 text-4xl font-bold text-white">{optInUsersCount}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/80">Utilisateurs ayant activé le résumé.</p>
          </Link>

          <Link
            href="/admin/cron"
            className="rounded-3xl border border-red-400/20 bg-red-400/10 p-5 shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:border-red-300/35 hover:bg-red-400/15"
          >
            <p className="text-sm font-semibold text-red-100">Échecs email</p>
            <p className="mt-4 text-4xl font-bold text-white">{failedWeeklyLogsCount}</p>
            <p className="mt-3 text-sm leading-6 text-red-100/80">Résumés hebdomadaires à contrôler.</p>
          </Link>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Beta privée</h2>
                <p className="mt-1 text-sm text-slate-400">Qualification et ouverture des accès.</p>
              </div>
              <Link
                href="/admin/beta-requests"
                className="inline-flex justify-center rounded-2xl bg-blue-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
              >
                Gérer les demandes
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {BETA_ACCESS_STATUSES.map((status) => (
                <div key={status} className={`rounded-2xl border p-4 ${getBetaStatusTone(status)}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{status}</p>
                  <p className="mt-2 text-3xl font-bold text-white">{betaCounts[status]}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {recentBetaRequests.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                  Aucune demande récente.
                </p>
              ) : (
                recentBetaRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{request.company}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{request.full_name} · {request.email}</p>
                      </div>
                      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getBetaStatusTone(request.status as BetaAccessStatus)}`}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Emails automatiques</h2>
                <p className="mt-1 text-sm text-slate-400">Résumé hebdomadaire et configuration serveur.</p>
              </div>
              <Link
                href="/admin/cron"
                className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
              >
                Voir le monitoring
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className={`rounded-2xl border p-4 ${cronSecretConfigured ? "border-emerald-400/20 bg-emerald-400/10" : "border-red-400/20 bg-red-400/10"}`}>
                <p className="text-sm font-semibold text-white">CRON_SECRET</p>
                <p className="mt-2 text-sm text-slate-300">{cronSecretConfigured ? "Configuré" : "Manquant"}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${resendConfigured ? "border-emerald-400/20 bg-emerald-400/10" : "border-red-400/20 bg-red-400/10"}`}>
                <p className="text-sm font-semibold text-white">RESEND_API_KEY</p>
                <p className="mt-2 text-sm text-slate-300">{resendConfigured ? "Configuré" : "Manquant"}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Résumé hebdomadaire</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {sentWeeklyLogsCount} email{sentWeeklyLogsCount > 1 ? "s" : ""} envoyé{sentWeeklyLogsCount > 1 ? "s" : ""}. Aucun résumé n’est envoyé sans activation explicite dans Mon compte.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {recentWeeklyLogs.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                  Aucun log hebdomadaire récent.
                </p>
              ) : (
                recentWeeklyLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-w-0 truncate text-sm font-semibold text-white">{log.email || "Email indisponible"}</p>
                      <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">
                        {log.status || "inconnu"}
                      </span>
                    </div>
                    {log.error_message ? (
                      <p className="mt-2 line-clamp-2 text-xs text-red-200">{log.error_message}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
