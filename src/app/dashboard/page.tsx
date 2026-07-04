import Link from "next/link";
import { redirect } from "next/navigation";
import DeadlineOnboardingEmptyState from "@/components/DeadlineOnboardingEmptyState";
import LogoutButton from "@/components/LogoutButton";
import { getDeadlineDocumentsByDeadlineId } from "@/lib/deadline-documents-server";
import { isUserAdmin } from "@/lib/user-roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Deadline = {
  id: number;
  title: string;
  category: string;
  due_date: string;
  created_at: string;
  user_id: string | null;
};

type RiskSummary = {
  label: string;
  title: string;
  description: string;
  score: number;
  badgeClassName: string;
  panelClassName: string;
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

function getRiskSummary({
  total,
  lateCount,
  next7Count,
  next30Count,
}: {
  total: number;
  lateCount: number;
  next7Count: number;
  next30Count: number;
}): RiskSummary {
  if (total === 0) {
    return {
      label: "Initialisation",
      title: "Votre cockpit administratif est prêt à être configuré.",
      description:
        "Ajoutez vos premières échéances pour commencer à anticiper les obligations importantes de votre entreprise.",
      score: 0,
      badgeClassName: "border-blue-400/30 bg-blue-400/10 text-blue-100",
      panelClassName: "border-blue-400/20 bg-blue-400/10",
    };
  }

  if (lateCount > 0) {
    return {
      label: "Risque élevé",
      title: "Des échéances nécessitent une action immédiate.",
      description:
        "Traitez les éléments en retard en priorité pour limiter les risques de non-conformité, de pénalité ou d’interruption d’activité.",
      score: Math.max(8, 100 - lateCount * 28 - next7Count * 12 - next30Count * 4),
      badgeClassName: "border-red-400/30 bg-red-400/10 text-red-100",
      panelClassName: "border-red-400/20 bg-red-400/10",
    };
  }

  if (next7Count > 0) {
    return {
      label: "À surveiller",
      title: "Certaines échéances arrivent très bientôt.",
      description:
        "Votre situation est saine, mais les prochains jours demandent de l’attention pour éviter tout retard.",
      score: Math.max(35, 100 - next7Count * 14 - next30Count * 4),
      badgeClassName: "border-orange-400/30 bg-orange-400/10 text-orange-100",
      panelClassName: "border-orange-400/20 bg-orange-400/10",
    };
  }

  if (next30Count > 0) {
    return {
      label: "Planifié",
      title: "Votre mois à venir est identifié.",
      description:
        "Les prochaines obligations sont visibles suffisamment tôt pour être préparées sans urgence.",
      score: Math.max(68, 100 - next30Count * 5),
      badgeClassName: "border-yellow-400/30 bg-yellow-400/10 text-yellow-100",
      panelClassName: "border-yellow-400/20 bg-yellow-400/10",
    };
  }

  return {
    label: "Sous contrôle",
    title: "Aucune échéance critique à court terme.",
    description:
      "Votre suivi est à jour. Continuez à centraliser vos obligations pour garder une visibilité complète.",
    score: 100,
    badgeClassName: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
    panelClassName: "border-emerald-400/20 bg-emerald-400/10",
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

  const { data: deadlines, error } = await supabase
    .from("deadlines")
    .select("id, title, category, due_date, created_at, user_id")
    .eq("user_id", user.id)
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
      document: documentsByDeadlineId.get(deadline.id) ?? null,
    };
  });

  const total = enrichedDeadlines.length;
  const lateCount = enrichedDeadlines.filter(
    (deadline) => deadline.daysUntilDeadline < 0
  ).length;
  const todayCount = enrichedDeadlines.filter(
    (deadline) => deadline.daysUntilDeadline === 0
  ).length;
  const next7Count = enrichedDeadlines.filter(
    (deadline) =>
      deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 7
  ).length;
  const next30Count = enrichedDeadlines.filter(
    (deadline) =>
      deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 30
  ).length;
  const safeCount = enrichedDeadlines.filter(
    (deadline) => deadline.daysUntilDeadline > 30
  ).length;
  const documentCount = enrichedDeadlines.filter((deadline) => deadline.document).length;
  const isAdminUser = await isUserAdmin(user.id);

  const urgentDeadlines = enrichedDeadlines
    .filter((deadline) => deadline.daysUntilDeadline <= 30)
    .slice(0, 5);
  const nextCriticalDeadline = enrichedDeadlines[0];
  const riskSummary = getRiskSummary({
    total,
    lateCount,
    next7Count,
    next30Count,
  });

  const categoryBreakdown = Object.entries(
    enrichedDeadlines.reduce<Record<string, number>>((accumulator, deadline) => {
      const category = deadline.category || "Sans catégorie";
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

  const statCards = [
    {
      label: "En retard",
      value: lateCount,
      helper: "À traiter en priorité",
      className: "border-red-500/20 bg-red-500/10",
      valueClassName: "text-red-100",
    },
    {
      label: "Aujourd’hui",
      value: todayCount,
      helper: "Actions du jour",
      className: "border-orange-500/20 bg-orange-500/10",
      valueClassName: "text-orange-100",
    },
    {
      label: "Sous 30 jours",
      value: next30Count,
      helper: "À anticiper maintenant",
      className: "border-yellow-500/20 bg-yellow-500/10",
      valueClassName: "text-yellow-100",
    },
    {
      label: "Total suivies",
      value: total,
      helper: `${documentCount} document${documentCount > 1 ? "s" : ""} associé${documentCount > 1 ? "s" : ""}`,
      className: "border-emerald-500/20 bg-emerald-500/10",
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
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="group flex w-fit items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-300/25 bg-blue-400/10 shadow-[0_0_40px_rgba(59,130,246,0.18)] transition group-hover:border-blue-200/40 group-hover:bg-blue-400/15">
              <span className="h-4 w-4 rounded-full bg-blue-300 shadow-[0_0_24px_rgba(147,197,253,0.85)]" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[0.28em] text-blue-100">
                DUEPILOT
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">
                Espace de suivi
              </span>
            </span>
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/deadlines"
              className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
            >
              Voir les échéances
            </Link>
            <Link
              href="/deadlines/new"
              className="inline-flex justify-center rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
            >
              Nouvelle échéance
            </Link>
            {isAdminUser ? (
              <Link
                href="/admin/beta-requests"
                className="inline-flex justify-center rounded-xl border border-purple-300/20 bg-purple-400/10 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:-translate-y-0.5 hover:border-purple-300/40 hover:bg-purple-400/15 hover:text-white"
              >
                Admin beta
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </header>

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
Vue d’ensemble
                </div>

                <p className="mt-5 text-sm font-medium text-slate-300">
                  Connecté : {user.email ?? "utilisateur DuePilot"}
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

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/deadlines"
                    className="inline-flex justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
                  >
                    Accéder aux échéances
                  </Link>
                  <Link
                    href="/deadlines/new"
                    className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                  >
                    Ajouter une échéance
                  </Link>
                </div>
              </div>

              <div className={`rounded-3xl border p-5 ${riskSummary.panelClassName}`}>
                <div className="flex items-center justify-between gap-4">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskSummary.badgeClassName}`}
                  >
                    {riskSummary.label}
                  </span>
                  <span className="text-sm font-medium text-slate-300">
Santé administrative
                  </span>
                </div>

                <div className="mt-5 flex items-end gap-2" aria-label={`Santé administrative ${riskSummary.score} sur 100`}>
                  <p className="text-5xl font-bold tracking-tight text-white">
                    {riskSummary.score}
                  </p>
                  <p className="pb-2 text-sm font-semibold text-slate-300">/100</p>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${riskSummary.score}%` }}
                  />
                </div>

                <h2 className="mt-5 text-lg font-semibold text-white">
                  {riskSummary.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Ce score tient compte des retards, urgences à 7 jours et échéances à anticiper.
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
                            {deadline.category} · {deadline.formattedDate}
                          </p>
                          {deadline.document ? (
                            <span className="mt-2 inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs font-semibold text-blue-100">
                              PDF joint
                            </span>
                          ) : null}
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
                        href={`/deadlines/documents/${nextCriticalDeadline.document.id}`}
                        className="mt-3 inline-flex w-full justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white"
                      >
                        Voir le PDF joint
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
