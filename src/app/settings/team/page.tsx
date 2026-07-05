import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import LogoutButton from "@/components/LogoutButton";
import {
  ensureUserOrganization,
  ORGANIZATION_ROLE_LABELS,
} from "@/lib/organizations";
import {
  cancelOrganizationInvitation,
  canManageOrganizationTeam,
  getOrganizationInvitations,
  getOrganizationMembers,
  inviteOrganizationMember,
} from "@/lib/team-invitations";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TeamSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatDate(date: string | null | undefined) {
  if (!date) return "Date indisponible";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function getStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "En attente";
    case "accepted":
      return "Acceptée";
    case "canceled":
      return "Annulée";
    case "expired":
      return "Expirée";
    default:
      return "Inconnue";
  }
}

function getStatusClassName(status: string) {
  switch (status) {
    case "pending":
      return "border-yellow-400/25 bg-yellow-400/10 text-yellow-100";
    case "accepted":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
    case "canceled":
      return "border-slate-400/20 bg-slate-400/10 text-slate-300";
    case "expired":
      return "border-red-400/25 bg-red-400/10 text-red-100";
    default:
      return "border-slate-400/20 bg-slate-400/10 text-slate-300";
  }
}

async function inviteMemberAction(formData: FormData) {
  "use server";

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

  if (!userOrganization) {
    redirect("/settings/team?error=organization");
  }

  const result = await inviteOrganizationMember({
    organizationId: userOrganization.organization.id,
    invitedByUserId: user.id,
    invitedByRole: userOrganization.membership.role,
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "member"),
  });

  revalidatePath("/settings/team");

  if (!result.success) {
    redirect(`/settings/team?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/settings/team?invited=1");
}

async function cancelInvitationAction(formData: FormData) {
  "use server";

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

  if (!userOrganization) {
    redirect("/settings/team?error=organization");
  }

  const result = await cancelOrganizationInvitation({
    organizationId: userOrganization.organization.id,
    invitationId: String(formData.get("invitationId") ?? ""),
    userRole: userOrganization.membership.role,
  });

  revalidatePath("/settings/team");

  if (!result.success) {
    redirect(`/settings/team?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/settings/team?canceled=1");
}

export default async function TeamSettingsPage({
  searchParams,
}: TeamSettingsPageProps) {
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};
  const invited = getSearchParam(params, "invited") === "1";
  const canceled = getSearchParam(params, "canceled") === "1";
  const accepted = getSearchParam(params, "accepted") === "1";
  const error = getSearchParam(params, "error");

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

  if (!userOrganization) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Impossible de charger l’équipe pour le moment. Vérifiez que la
            migration Supabase des organisations a bien été exécutée.
          </p>
        </div>
      </main>
    );
  }

  const { organization, membership } = userOrganization;
  const canManageTeam = canManageOrganizationTeam(membership.role);
  const members = await getOrganizationMembers(organization.id);
  const invitations = await getOrganizationInvitations(organization.id);
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === "pending"
  );
  const pastInvitations = invitations.filter(
    (invitation) => invitation.status !== "pending"
  ).slice(0, 6);

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
                Paramètres équipe
              </span>
            </span>
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/dashboard"
              className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/settings/company"
              className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
            >
              Entreprise
            </Link>
            <LogoutButton />
          </div>
        </header>

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                Équipe
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Préparez DuePilot pour travailler à plusieurs.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Invitez les personnes qui devront suivre les échéances de
                l’entreprise. Cette V1 pose la base des futurs accès partagés,
                rôles et validations d’équipe.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-sm font-semibold text-slate-400">Entreprise</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {organization.name}
              </p>
              <p className="mt-3 text-sm text-slate-400">
                Votre rôle :{" "}
                <span className="font-semibold text-blue-100">
                  {ORGANIZATION_ROLE_LABELS[membership.role]}
                </span>
              </p>
            </div>
          </div>
        </section>

        {invited || canceled || accepted || error ? (
          <div className="mt-5 grid gap-3">
            {invited ? (
              <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Invitation enregistrée et envoyée.
              </p>
            ) : null}
            {canceled ? (
              <p className="rounded-2xl border border-slate-400/20 bg-slate-400/10 px-4 py-3 text-sm text-slate-200">
                Invitation annulée.
              </p>
            ) : null}
            {accepted ? (
              <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Invitation acceptée. Le membre est maintenant rattaché à
                l’entreprise.
              </p>
            ) : null}
            {error ? (
              <p className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Membres actifs</p>
            <p className="mt-3 text-3xl font-bold text-white">{members.length}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Invitations en attente</p>
            <p className="mt-3 text-3xl font-bold text-white">
              {pendingInvitations.length}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Droits équipe</p>
            <p className="mt-3 text-xl font-bold text-white">
              {canManageTeam ? "Gestion activée" : "Lecture seule"}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/10">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Inviter un collaborateur
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                L’invitation crée un accès rattaché à l’entreprise. Si la
                personne n’a pas encore de compte DuePilot, elle devra d’abord
                être activée dans la beta privée.
              </p>
            </div>

            {canManageTeam ? (
              <form action={inviteMemberAction} className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-200">
                    Email professionnel
                  </span>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="collaborateur@entreprise.fr"
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/60 focus:ring-4 focus:ring-blue-400/10"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-200">
                    Rôle
                  </span>
                  <select
                    name="role"
                    defaultValue="member"
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/60 focus:ring-4 focus:ring-blue-400/10"
                  >
                    <option value="admin">Administrateur</option>
                    <option value="member">Membre</option>
                    <option value="viewer">Lecteur</option>
                  </select>
                </label>

                <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4 text-sm leading-6 text-blue-50">
                  <strong>Rôles disponibles :</strong>
                  <br />
                  Administrateur : peut gérer l’équipe.
                  <br />
                  Membre : peut participer au suivi.
                  <br />
                  Lecteur : accès préparé pour la consultation seule.
                </div>

                <button
                  type="submit"
                  className="inline-flex justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
                >
                  Envoyer l’invitation
                </button>
              </form>
            ) : (
              <p className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
                Votre rôle actuel ne permet pas d’inviter de nouveaux membres.
              </p>
            )}
          </div>

          <div className="grid gap-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/10">
              <h2 className="text-2xl font-bold text-white">Membres</h2>
              <div className="mt-5 grid gap-3">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-white">
                          {member.email}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Ajouté le {formatDate(member.createdAt)}
                        </p>
                      </div>
                      <span className="w-fit rounded-full border border-blue-400/25 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">
                        {member.roleLabel}
                      </span>
                    </div>
                  </div>
                ))}

                {members.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-400">
                    Aucun membre actif trouvé.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/10">
              <h2 className="text-2xl font-bold text-white">
                Invitations en attente
              </h2>
              <div className="mt-5 grid gap-3">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-white">
                          {invitation.email}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Expire le {formatDate(invitation.expiresAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-blue-400/25 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">
                          {invitation.roleLabel}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(
                            invitation.status
                          )}`}
                        >
                          {getStatusLabel(invitation.status)}
                        </span>
                      </div>
                    </div>

                    {canManageTeam ? (
                      <form action={cancelInvitationAction} className="mt-4">
                        <input
                          type="hidden"
                          name="invitationId"
                          value={invitation.id}
                        />
                        <button
                          type="submit"
                          className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-300/40 hover:bg-red-400/15"
                        >
                          Annuler l’invitation
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}

                {pendingInvitations.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-400">
                    Aucune invitation en attente.
                  </p>
                ) : null}
              </div>
            </div>

            {pastInvitations.length > 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/10">
                <h2 className="text-2xl font-bold text-white">
                  Historique récent
                </h2>
                <div className="mt-5 grid gap-3">
                  {pastInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-white">
                          {invitation.email}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {formatDate(invitation.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(
                          invitation.status
                        )}`}
                      >
                        {getStatusLabel(invitation.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
