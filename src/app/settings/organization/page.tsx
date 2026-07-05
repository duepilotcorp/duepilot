import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import {
  ensureUserOrganization,
  ORGANIZATION_ROLE_LABELS,
  updateUserOrganizationName,
} from "@/lib/organizations";
import {
  cancelOrganizationInvitation,
  canManageOrganizationTeam,
  disableOrganizationMember,
  getOrganizationInvitations,
  getOrganizationMembers,
  inviteOrganizationMember,
  updateOrganizationMemberRole,
} from "@/lib/team-invitations";
import { createClient } from "@/lib/supabase/server";
import { getUserDisplayName } from "@/lib/user-display";
import { isUserAdmin } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

type OrganizationSettingsPageProps = {
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

async function updateOrganizationAction(formData: FormData) {
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
    redirect("/settings/organization?error=organization");
  }

  const result = await updateUserOrganizationName({
    userId: user.id,
    organizationId: userOrganization.organization.id,
    name: String(formData.get("name") ?? ""),
  });

  revalidatePath("/settings/organization");
  revalidatePath("/settings/account");
  revalidatePath("/dashboard");

  if (!result.success) {
    redirect(`/settings/organization?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/settings/organization?saved=1");
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
    redirect("/settings/organization?error=organization");
  }

  const result = await inviteOrganizationMember({
    organizationId: userOrganization.organization.id,
    invitedByUserId: user.id,
    invitedByRole: userOrganization.membership.role,
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "member"),
  });

  revalidatePath("/settings/organization");

  if (!result.success) {
    redirect(`/settings/organization?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/settings/organization?invited=1");
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
    redirect("/settings/organization?error=organization");
  }

  const result = await cancelOrganizationInvitation({
    organizationId: userOrganization.organization.id,
    invitationId: String(formData.get("invitationId") ?? ""),
    userRole: userOrganization.membership.role,
  });

  revalidatePath("/settings/organization");

  if (!result.success) {
    redirect(`/settings/organization?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/settings/organization?canceled=1");
}


async function updateMemberRoleAction(formData: FormData) {
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
    redirect("/settings/organization?error=organization");
  }

  const result = await updateOrganizationMemberRole({
    organizationId: userOrganization.organization.id,
    actingUserId: user.id,
    actingUserRole: userOrganization.membership.role,
    targetUserId: String(formData.get("userId") ?? ""),
    newRole: String(formData.get("role") ?? "member"),
  });

  revalidatePath("/settings/organization");
  revalidatePath("/settings/account");
  revalidatePath("/dashboard");
  revalidatePath("/deadlines");

  if (!result.success) {
    redirect(`/settings/organization?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/settings/organization?roleUpdated=1");
}

async function removeMemberAction(formData: FormData) {
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
    redirect("/settings/organization?error=organization");
  }

  const result = await disableOrganizationMember({
    organizationId: userOrganization.organization.id,
    actingUserId: user.id,
    actingUserRole: userOrganization.membership.role,
    targetUserId: String(formData.get("userId") ?? ""),
  });

  revalidatePath("/settings/organization");
  revalidatePath("/settings/account");
  revalidatePath("/dashboard");
  revalidatePath("/deadlines");

  if (!result.success) {
    redirect(`/settings/organization?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/settings/organization?memberRemoved=1");
}

export default async function OrganizationSettingsPage({
  searchParams,
}: OrganizationSettingsPageProps) {
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};
  const saved = getSearchParam(params, "saved") === "1";
  const invited = getSearchParam(params, "invited") === "1";
  const canceled = getSearchParam(params, "canceled") === "1";
  const accepted = getSearchParam(params, "accepted") === "1";
  const roleUpdated = getSearchParam(params, "roleUpdated") === "1";
  const memberRemoved = getSearchParam(params, "memberRemoved") === "1";
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
            Impossible de charger l’organisation pour le moment. Vérifiez que les migrations Supabase des organisations ont bien été exécutées.
          </p>
        </div>
      </main>
    );
  }

  const { organization, membership } = userOrganization;
  const canManageOrganization = canManageOrganizationTeam(membership.role);
  const members = await getOrganizationMembers(organization.id);
  const invitations = canManageOrganization
    ? await getOrganizationInvitations(organization.id)
    : [];
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === "pending"
  );
  const pastInvitations = invitations.filter(
    (invitation) => invitation.status !== "pending"
  ).slice(0, 6);
  const displayName = getUserDisplayName(user);
  const isAdminUser = await isUserAdmin(user.id);

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader
          subtitle={canManageOrganization ? "Organisation" : "Mon équipe"}
          userName={displayName}
          userEmail={user.email}
          organizationName={organization.name}
          organizationRole={membership.role}
          isAdminUser={isAdminUser}
          active="organization"
        />

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                {canManageOrganization ? "Centre de gestion" : "Informations équipe"}
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {canManageOrganization
                  ? "Entreprise et équipe regroupées au même endroit."
                  : "Votre équipe DuePilot, en lecture simple."}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                {canManageOrganization
                  ? "Gérez le nom de l’entreprise, les membres, les invitations et les rôles depuis une seule page, sans multiplier les boutons dans l’interface."
                  : "Consultez l’entreprise active et les personnes rattachées à l’équipe. Les invitations et paramètres sensibles restent réservés aux administrateurs."}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-sm font-semibold text-slate-400">Organisation active</p>
              <p className="mt-2 break-words text-3xl font-bold text-white">
                {organization.name}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">
                  Rôle : {ORGANIZATION_ROLE_LABELS[membership.role]}
                </span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {members.length} membre{members.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </section>

        {saved || invited || canceled || accepted || roleUpdated || memberRemoved || error ? (
          <div className="mt-5 grid gap-3">
            {saved ? (
              <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Organisation mise à jour.
              </p>
            ) : null}
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
                Invitation acceptée. Le membre est maintenant rattaché à l’entreprise.
              </p>
            ) : null}
            {roleUpdated ? (
              <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Rôle du membre mis à jour.
              </p>
            ) : null}
            {memberRemoved ? (
              <p className="rounded-2xl border border-slate-400/20 bg-slate-400/10 px-4 py-3 text-sm text-slate-200">
                Membre retiré de l’organisation.
              </p>
            ) : null}
            {error ? (
              <p className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {error === "organization" ? "Impossible de charger l’organisation." : decodeURIComponent(error)}
              </p>
            ) : null}
          </div>
        ) : null}

        <section className={`mt-6 grid gap-4 ${canManageOrganization ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-center sm:text-left">
            <p className="text-sm text-slate-400">Membres actifs</p>
            <p className="mt-3 text-3xl font-bold text-white">{members.length}</p>
          </div>
          {canManageOrganization ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-center sm:text-left">
              <p className="text-sm text-slate-400">Invitations en attente</p>
              <p className="mt-3 text-3xl font-bold text-white">
                {pendingInvitations.length}
              </p>
            </div>
          ) : null}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-center sm:text-left">
            <p className="text-sm text-slate-400">Droits</p>
            <p className="mt-3 text-xl font-bold text-white">
              {canManageOrganization ? "Gestion complète" : "Lecture équipe"}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <form
              action={updateOrganizationAction}
              className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/10"
            >
              <div className="border-b border-white/10 pb-5">
                <h2 className="text-2xl font-bold text-white">
                  Informations entreprise
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {canManageOrganization
                    ? "Ce nom sert de base à l’équipe, aux échéances partagées et aux futurs abonnements."
                    : "Ces informations sont visibles par les membres, mais modifiables uniquement par un administrateur."}
                </p>
              </div>

              <div className="mt-6">
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-semibold text-slate-100"
                >
                  Nom de l’entreprise
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  defaultValue={organization.name}
                  disabled={!canManageOrganization}
                  minLength={2}
                  maxLength={120}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {canManageOrganization ? (
                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex justify-center rounded-2xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                  >
                    Enregistrer l’organisation
                  </button>
                </div>
              ) : null}
            </form>

            {canManageOrganization ? (
              <form
                action={inviteMemberAction}
                className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/10"
              >
                <div className="border-b border-white/10 pb-5">
                  <h2 className="text-2xl font-bold text-white">
                    Inviter un collaborateur
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Les invitations et rôles sont réservés aux propriétaires et administrateurs.
                  </p>
                </div>

                <div className="mt-6 grid gap-4">
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

                  <button
                    type="submit"
                    className="inline-flex justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
                  >
                    Envoyer l’invitation
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-[2rem] border border-blue-400/20 bg-blue-400/10 p-6 shadow-2xl shadow-black/10">
                <h2 className="text-xl font-bold text-white">Accès membre</h2>
                <p className="mt-3 text-sm leading-6 text-blue-100/85">
                  Vous pouvez consulter la composition de l’équipe et participer au suivi des échéances selon votre rôle. Les invitations, membres en attente et paramètres d’entreprise ne sont pas affichés sur ce compte.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/10">
              <h2 className="text-2xl font-bold text-white">Composition de l’équipe</h2>
              <div className="mt-5 grid gap-3">
                {members.map((member) => {
                  const isCurrentUser = member.userId === user.id;
                  const isOwnerMember = member.role === "owner";
                  const isAdminMember = member.role === "admin";
                  const canEditThisMember =
                    canManageOrganization &&
                    !isCurrentUser &&
                    !isOwnerMember &&
                    (membership.role === "owner" || !isAdminMember);

                  return (
                    <div
                      key={member.userId}
                      className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-white">
                            {member.displayName}
                          </p>
                          <p className="mt-1 break-words text-sm text-slate-500">
                            {member.email}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            Ajouté le {formatDate(member.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <span className="w-fit rounded-full border border-blue-400/25 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">
                            {member.roleLabel}
                          </span>
                          {isCurrentUser ? (
                            <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                              Vous
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {canManageOrganization ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          {canEditThisMember ? (
                            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                              <form action={updateMemberRoleAction} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                                <input type="hidden" name="userId" value={member.userId} />
                                <label className="grid gap-2">
                                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    Modifier le rôle
                                  </span>
                                  <select
                                    name="role"
                                    defaultValue={member.role}
                                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-400/60"
                                  >
                                    <option value="admin">Administrateur</option>
                                    <option value="member">Membre</option>
                                    <option value="viewer">Lecteur</option>
                                  </select>
                                </label>
                                <button
                                  type="submit"
                                  className="rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white"
                                >
                                  Mettre à jour
                                </button>
                              </form>

                              <form action={removeMemberAction}>
                                <input type="hidden" name="userId" value={member.userId} />
                                <button
                                  type="submit"
                                  className="w-full rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-300/40 hover:bg-red-400/15 lg:w-auto"
                                >
                                  Supprimer
                                </button>
                              </form>
                            </div>
                          ) : (
                            <p className="text-xs leading-5 text-slate-500">
                              {isOwnerMember
                                ? "Le propriétaire ne peut pas être modifié depuis cette page."
                                : isCurrentUser
                                  ? "Votre propre rôle et votre accès ne peuvent pas être modifiés ici."
                                  : "Seul le propriétaire peut modifier ou supprimer un administrateur."}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {members.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-400">
                    Aucun membre actif trouvé.
                  </p>
                ) : null}
              </div>
            </div>

            {canManageOrganization ? (
              <>
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
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-white">
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
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(invitation.status)}`}>
                              {getStatusLabel(invitation.status)}
                            </span>
                          </div>
                        </div>

                        <form action={cancelInvitationAction} className="mt-4">
                          <input type="hidden" name="invitationId" value={invitation.id} />
                          <button
                            type="submit"
                            className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-300/40 hover:bg-red-400/15"
                          >
                            Annuler l’invitation
                          </button>
                        </form>
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
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-white">
                              {invitation.email}
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                              {formatDate(invitation.createdAt)}
                            </p>
                          </div>
                          <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(invitation.status)}`}>
                            {getStatusLabel(invitation.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
