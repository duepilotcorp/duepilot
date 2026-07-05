import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import LogoutButton from "@/components/LogoutButton";
import {
  acceptOrganizationInvitation,
  getPendingInvitationByToken,
} from "@/lib/team-invitations";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvitationPageProps = {
  params: Promise<{
    token: string;
  }>;
};

async function acceptInvitationAction(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const token = String(formData.get("token") ?? "");
  const result = await acceptOrganizationInvitation({
    token,
    userId: user.id,
    userEmail: user.email,
  });

  revalidatePath("/settings/team");
  revalidatePath("/dashboard");

  if (!result.success) {
    redirect(`/team/invitations/${token}?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/settings/team?accepted=1");
}

export default async function TeamInvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/login?redirectedFrom=/team/invitations/${token}`);
  }

  const invitation = await getPendingInvitationByToken(token);

  const emailMatches =
    invitation?.email?.toLowerCase() === user.email?.toLowerCase();

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-5 py-6 sm:px-8 lg:px-10">
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
                Invitation équipe
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
            <LogoutButton />
          </div>
        </header>

        <section className="premium-sheen mt-10 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in sm:p-8 lg:p-10">
          {!invitation ? (
            <div>
              <div className="inline-flex rounded-full border border-red-400/25 bg-red-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-red-100">
                Invitation indisponible
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Cette invitation n’est plus active.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Elle a peut-être déjà été acceptée, annulée ou expirée.
                Demandez à l’administrateur de l’entreprise de renvoyer une
                invitation si nécessaire.
              </p>
              <Link
                href="/dashboard"
                className="mt-8 inline-flex rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
              >
                Retour au dashboard
              </Link>
            </div>
          ) : !emailMatches ? (
            <div>
              <div className="inline-flex rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-yellow-100">
                Mauvais compte connecté
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Connectez-vous avec l’adresse invitée.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Cette invitation est destinée à{" "}
                <span className="font-semibold text-white">{invitation.email}</span>.
                Vous êtes actuellement connecté avec{" "}
                <span className="font-semibold text-white">
                  {user.email ?? "un autre compte"}
                </span>.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LogoutButton />
                <Link
                  href="/login"
                  className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-bold text-slate-200 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
                >
                  Se connecter avec un autre compte
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                Invitation active
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Rejoindre l’espace entreprise.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Vous allez être rattaché à cette entreprise avec le rôle{" "}
                <span className="font-semibold text-white">
                  {invitation.roleLabel}
                </span>.
              </p>

              <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                <p className="text-sm font-semibold text-slate-400">
                  Adresse invitée
                </p>
                <p className="mt-2 text-xl font-bold text-white">
                  {invitation.email}
                </p>
                <p className="mt-4 text-sm text-slate-400">
                  L’invitation expirera le{" "}
                  {invitation.expiresAt
                    ? new Intl.DateTimeFormat("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(invitation.expiresAt))
                    : "date indisponible"}
                  .
                </p>
              </div>

              <form action={acceptInvitationAction} className="mt-8">
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="inline-flex rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
                >
                  Accepter l’invitation
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
