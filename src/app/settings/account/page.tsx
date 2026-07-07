import Link from "next/link";
import { redirect } from "next/navigation";
import AccountEmailPreferencesForm from "@/components/AccountEmailPreferencesForm";
import AccountSecurityAssurancePanel from "@/components/AccountSecurityAssurancePanel";
import AccountPasswordForm from "@/components/AccountPasswordForm";
import AccountProfileForm from "@/components/AccountProfileForm";
import AppHeader from "@/components/AppHeader";
import LogoutButton from "@/components/LogoutButton";
import {
  ensureUserOrganization,
  ORGANIZATION_ROLE_LABELS,
} from "@/lib/organizations";
import { getUserDisplayName } from "@/lib/user-display";
import { isUserAdmin } from "@/lib/user-roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  for (const key of keys) {
    const value = metadata?.[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return "Non disponible";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const metadata = user.user_metadata as Record<string, unknown> | null;
  const storedFullName = getMetadataString(metadata, ["full_name", "name"]);
  const displayName = getUserDisplayName(user);
  const email = user.email ?? "Email indisponible";
  const emailConfirmed = Boolean(user.email_confirmed_at);

  const [userOrganization, isAdminUser, emailPreferencesResult] = await Promise.all([
    ensureUserOrganization({
      userId: user.id,
      email: user.email,
    }),
    isUserAdmin(user.id),
    supabase
      .from("user_notification_preferences")
      .select("weekly_summary_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const organizationName = userOrganization?.organization.name ?? "Mon entreprise";
  const roleLabel = userOrganization
    ? ORGANIZATION_ROLE_LABELS[userOrganization.membership.role]
    : "Non défini";
  const canManageOrganization =
    userOrganization?.membership.role === "owner" ||
    userOrganization?.membership.role === "admin";

  const { data: emailPreferences, error: emailPreferencesError } = emailPreferencesResult;

  if (emailPreferencesError) {
    console.warn("DuePilot email preferences unavailable.", emailPreferencesError);
  }

  const weeklySummaryEnabled = Boolean(
    emailPreferences?.weekly_summary_enabled
  );

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader
          subtitle="Compte et sécurité"
          userName={displayName}
          userEmail={user.email}
          organizationName={organizationName}
          organizationRole={userOrganization?.membership.role}
          isAdminUser={isAdminUser}
          active="account"
        />

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                Compte utilisateur
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Votre identité et votre sécurité DuePilot.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Retrouvez votre e-mail connecté, votre entreprise active et les
                actions essentielles pour sécuriser votre accès à la beta privée.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-sm font-medium text-slate-400">Compte connecté</p>
              <p className="mt-3 break-words text-3xl font-bold text-white">
                {displayName}
              </p>
              <p className="mt-2 break-words text-sm text-slate-400">{email}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">
                  Session active
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    emailConfirmed
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                      : "border-yellow-400/25 bg-yellow-400/10 text-yellow-100"
                  }`}
                >
                  {emailConfirmed ? "E-mail confirmé" : "E-mail à confirmer"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <AccountSecurityAssurancePanel />
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.78fr]">
          <div className="space-y-6">
            <AccountProfileForm initialFullName={storedFullName} email={email} />
            <AccountEmailPreferencesForm
              initialWeeklySummaryEnabled={weeklySummaryEnabled}
            />
            <AccountPasswordForm />
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
              <h2 className="text-xl font-bold text-white">Résumé du compte</h2>
              <div className="mt-5 space-y-4 text-sm">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Identifiant
                  </p>
                  <p className="mt-2 break-words font-medium text-slate-100">{email}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Création du compte
                  </p>
                  <p className="mt-2 text-slate-100">{formatDateTime(user.created_at)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Dernière connexion
                  </p>
                  <p className="mt-2 text-slate-100">
                    {formatDateTime(user.last_sign_in_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-400/20 bg-blue-400/10 p-6 shadow-2xl shadow-blue-950/20">
              <h2 className="text-xl font-bold text-white">Entreprise liée</h2>
              <p className="mt-3 text-sm leading-6 text-blue-100/85">
                Votre compte est rattaché à une organisation. C’est cette base
                qui pilote les échéances d’équipe, les invitations et les futurs
                abonnements.
              </p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200/70">
                  Organisation active
                </p>
                <p className="mt-2 text-lg font-bold text-white">{organizationName}</p>
                <p className="mt-1 text-sm text-blue-100/80">Rôle : {roleLabel}</p>
              </div>
              {canManageOrganization ? (
                <div className="mt-5">
                  <Link
                    href="/settings/organization"
                    className="inline-flex w-full justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-blue-50 transition hover:border-blue-200/30 hover:bg-blue-400/15"
                  >
                    Gérer l’organisation
                  </Link>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-blue-100/80">
                  Votre rôle vous donne accès à la composition de l’équipe, sans modifier les paramètres de l’entreprise.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
              <h2 className="text-xl font-bold text-white">Bonnes pratiques</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                <li>• Utilisez un mot de passe unique pour DuePilot.</li>
                <li>• Déconnectez-vous après utilisation sur un poste partagé.</li>
                <li>• Gardez votre entreprise et votre équipe à jour.</li>
              </ul>
              <div className="mt-5">
                <LogoutButton />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
