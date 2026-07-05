import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import LogoutButton from "@/components/LogoutButton";
import {
  ensureUserOrganization,
  ORGANIZATION_ROLE_LABELS,
  updateUserOrganizationName,
} from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CompanySettingsPageProps = {
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

async function updateCompanySettings(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const organization = await ensureUserOrganization({
    userId: user.id,
    email: user.email,
  });

  if (!organization) {
    redirect("/settings/company?error=organization");
  }

  const name = String(formData.get("name") ?? "");
  const result = await updateUserOrganizationName({
    userId: user.id,
    organizationId: organization.organization.id,
    name,
  });

  revalidatePath("/settings/company");
  revalidatePath("/dashboard");

  if (!result.success) {
    redirect(`/settings/company?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/settings/company?saved=1");
}

export default async function CompanySettingsPage({
  searchParams,
}: CompanySettingsPageProps) {
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};
  const saved = getSearchParam(params, "saved") === "1";
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
            Impossible de préparer l’espace entreprise pour le moment. Vérifiez
            que la migration Supabase des organisations a bien été exécutée.
          </p>
        </div>
      </main>
    );
  }

  const { organization, membership } = userOrganization;
  const roleLabel = ORGANIZATION_ROLE_LABELS[membership.role];
  const canEditOrganization = membership.role === "owner" || membership.role === "admin";

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
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
                Paramètres entreprise
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
              href="/deadlines"
              className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
            >
              Échéances
            </Link>
            <Link
              href="/settings/team"
              className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
            >
              Équipe
            </Link>
            <LogoutButton />
          </div>
        </header>

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                Base multi-entreprise
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Votre entreprise devient le centre de DuePilot.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Cette première base prépare les futures invitations d’équipe,
                rôles métiers et abonnements par entreprise, sans changer votre
                usage actuel.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-sm font-medium text-slate-400">Entreprise active</p>
              <p className="mt-3 text-3xl font-bold text-white">
                {organization.name}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">
                  Rôle : {roleLabel}
                </span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  Organisation active
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.78fr]">
          <form
            action={updateCompanySettings}
            className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20"
          >
            <div className="border-b border-white/10 pb-5">
              <h2 className="text-2xl font-bold text-white">
                Informations entreprise
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Ce nom sera utilisé comme base d’organisation pour les futures
                fonctionnalités d’équipe et de facturation.
              </p>
            </div>

            {saved ? (
              <p className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100">
                Entreprise mise à jour.
              </p>
            ) : null}

            {error ? (
              <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-100">
                {error === "organization"
                  ? "Impossible de charger l’entreprise."
                  : decodeURIComponent(error)}
              </p>
            ) : null}

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
                disabled={!canEditOrganization}
                minLength={2}
                maxLength={120}
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Vous pourrez plus tard inviter des membres dans cette même
                entreprise.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/dashboard"
                className="inline-flex justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
              >
                Retour dashboard
              </Link>
              <button
                type="submit"
                disabled={!canEditOrganization}
                className="inline-flex justify-center rounded-2xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-blue-500/50"
              >
                Enregistrer l’entreprise
              </button>
            </div>
          </form>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
              <h2 className="text-xl font-bold text-white">
                Ce que cette base prépare
              </h2>
              <div className="mt-5 space-y-4">
                {[
                  "Échéances rattachées à une entreprise",
                  "Invitations de collaborateurs",
                  "Rôles owner, admin, membre et lecteur",
                  "Abonnement futur par entreprise",
                ].map((item) => (
                  <div key={item} className="flex gap-3 text-sm leading-6 text-slate-300">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-400/20 bg-blue-400/10 p-6 shadow-2xl shadow-slate-950/20">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100">
                Version V1
              </p>
              <p className="mt-3 text-sm leading-6 text-blue-100/80">
                Cette étape ne change pas encore le partage des échéances. Elle
                installe la base propre pour passer ensuite au multi-utilisateur
                sans refonte brutale.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
