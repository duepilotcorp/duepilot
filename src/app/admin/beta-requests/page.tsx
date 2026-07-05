import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import {
  BETA_ACCESS_STATUS_LABELS,
  BETA_ACCESS_STATUSES,
  isBetaAccessStatus,
  type BetaAccessStatus,
} from "@/lib/beta-access-admin";
import { isUserAdmin } from "@/lib/user-roles";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureUserOrganization } from "@/lib/organizations";
import { getUserDisplayName } from "@/lib/user-display";

export const dynamic = "force-dynamic";

type BetaAccessRequest = {
  id: string;
  created_at: string;
  updated_at: string | null;
  full_name: string;
  email: string;
  company: string;
  role: string;
  deadline_volume: string;
  message: string | null;
  status: BetaAccessStatus;
  internal_notes: string | null;
};

function formatDateTime(date: string | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getStatusClassName(status: BetaAccessStatus) {
  const classes: Record<BetaAccessStatus, string> = {
    new: "border-blue-400/25 bg-blue-400/10 text-blue-100",
    contacted: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
    accepted: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    rejected: "border-slate-400/20 bg-slate-400/10 text-slate-200",
  };

  return classes[status];
}

function getStatusDescription(status: BetaAccessStatus) {
  const descriptions: Record<BetaAccessStatus, string> = {
    new: "Demande reçue, à qualifier.",
    contacted: "L’entreprise a été recontactée.",
    accepted: "Accès beta validé ou à ouvrir.",
    rejected: "Demande écartée pour le moment.",
  };

  return descriptions[status];
}

async function updateBetaAccessRequest(formData: FormData) {
  "use server";

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

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const internalNotes = String(formData.get("internal_notes") ?? "")
    .trim()
    .slice(0, 1200);

  if (!id || !isBetaAccessStatus(status)) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("beta_access_requests")
    .update({
      status,
      internal_notes: internalNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  revalidatePath("/admin/beta-requests");
}

export default async function BetaRequestsAdminPage() {
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

  const { data, error } = await supabaseAdmin
    .from("beta_access_requests")
    .select(
      "id, created_at, updated_at, full_name, email, company, role, deadline_volume, message, status, internal_notes"
    )
    .order("created_at", { ascending: false })
    .returns<BetaAccessRequest[]>();

  if (error) {
    console.error(error);
  }

  const requests = data ?? [];
  const counts = BETA_ACCESS_STATUSES.reduce<Record<BetaAccessStatus, number>>(
    (accumulator, status) => {
      accumulator[status] = requests.filter((request) => request.status === status).length;
      return accumulator;
    },
    {
      new: 0,
      contacted: 0,
      accepted: 0,
      rejected: 0,
    }
  );

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader
          subtitle="Administration beta"
          userName={displayName}
          userEmail={user.email}
          organizationName={userOrganization?.organization.name}
          organizationRole={userOrganization?.membership.role}
          isAdminUser
          active="admin"
        />

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.8fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                  Beta privée
                </div>
                <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Demandes d’accès
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Centralisez les demandes entrantes, qualifiez les entreprises pilotes et suivez l’ouverture progressive de la beta DuePilot.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  File active
                </p>
                <p className="mt-4 text-5xl font-bold tracking-tight text-white">
                  {requests.length}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {counts.new} nouvelle{counts.new > 1 ? "s" : ""} demande{counts.new > 1 ? "s" : ""} à qualifier.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {BETA_ACCESS_STATUSES.map((status) => (
            <div
              key={status}
              className={`rounded-3xl border p-5 shadow-xl shadow-slate-950/20 ${getStatusClassName(status)}`}
            >
              <p className="text-sm font-semibold">{BETA_ACCESS_STATUS_LABELS[status]}</p>
              <p className="mt-4 text-5xl font-bold text-white">{counts[status]}</p>
              <p className="mt-3 text-sm opacity-80">{getStatusDescription(status)}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20 sm:p-6 animate-rise-in-delay-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Demandes reçues</h2>
              <p className="mt-1 text-sm text-slate-400">
                Les demandes sont aussi envoyées par email. Cette vue sert de suivi interne.
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
            >
              Voir le formulaire public
            </Link>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">
              Impossible de charger les demandes pour le moment.
            </div>
          ) : requests.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <p className="text-lg font-semibold text-white">Aucune demande pour le moment.</p>
              <p className="mt-2 text-sm text-slate-400">
                Les prochaines demandes envoyées depuis /register apparaîtront ici automatiquement.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {requests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-3xl border border-white/10 bg-slate-950/45 p-5 transition hover:border-blue-400/25 hover:bg-slate-950/65"
                >
                  <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                    <div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-white">
                            {request.company}
                          </h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {request.full_name} · {request.role}
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(request.status)}`}
                        >
                          {BETA_ACCESS_STATUS_LABELS[request.status]}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Email
                          </p>
                          <a
                            href={`mailto:${request.email}`}
                            className="mt-2 block break-all text-sm font-semibold text-blue-100 hover:text-blue-200"
                          >
                            {request.email}
                          </a>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Volume estimé
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-100">
                            {request.deadline_volume}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Message
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                          {request.message || "Aucun message complémentaire."}
                        </p>
                      </div>

                      <p className="mt-4 text-xs text-slate-500">
                        Demandé le {formatDateTime(request.created_at)} · Mis à jour le {formatDateTime(request.updated_at)}
                      </p>
                    </div>

                    <form action={updateBetaAccessRequest} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                      <input type="hidden" name="id" value={request.id} />

                      <label className="block text-sm font-semibold text-slate-200" htmlFor={`status-${request.id}`}>
                        Statut interne
                      </label>
                      <select
                        id={`status-${request.id}`}
                        name="status"
                        defaultValue={request.status}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-blue-400/70 focus:bg-slate-900"
                      >
                        {BETA_ACCESS_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {BETA_ACCESS_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>

                      <label className="mt-5 block text-sm font-semibold text-slate-200" htmlFor={`notes-${request.id}`}>
                        Notes internes
                      </label>
                      <textarea
                        id={`notes-${request.id}`}
                        name="internal_notes"
                        defaultValue={request.internal_notes ?? ""}
                        rows={5}
                        placeholder="Qualification, prochain contact, raison du refus, infos utiles..."
                        className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/70 focus:bg-slate-900"
                      />

                      <button
                        type="submit"
                        className="mt-4 inline-flex w-full justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
                      >
                        Enregistrer le suivi
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
