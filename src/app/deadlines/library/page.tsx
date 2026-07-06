import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import DeadlineTemplateManager from "@/components/DeadlineTemplateManager";
import {
  normalizeDeadlineTemplateRows,
  type DeadlineTemplateLibraryRow,
} from "@/lib/deadline-template-library";
import { ensureUserOrganization } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";
import { getUserDisplayName } from "@/lib/user-display";
import { isUserAdmin } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

export default async function DeadlineLibraryPage() {
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
  const displayName = getUserDisplayName(user);
  const isAdminUser = await isUserAdmin(user.id);

  const { data: templates, error: templatesError } = await supabase
    .from("deadline_templates")
    .select(
      "id, organization_id, created_by, visibility, name, title, description, category, category_key, custom_category_label, notification_days, recurrence_rule, importance_level, treatment_note, useful_link_url, useful_link_label, checklist_items, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (templatesError) {
    console.error(templatesError);
  }

  const normalizedTemplates = templatesError
    ? []
    : normalizeDeadlineTemplateRows((templates ?? []) as DeadlineTemplateLibraryRow[]);

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader
          subtitle="Bibliothèque d’échéances"
          userName={displayName}
          userEmail={user.email}
          organizationName={userOrganization?.organization.name}
          organizationRole={userOrganization?.membership.role}
          isAdminUser={isAdminUser}
          active="library"
        />

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur animate-rise-in">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                  Bibliothèque personnalisée
                </div>

                <h1 className="mt-5 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Vos modèles d’échéances réutilisables.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Sauvegardez les échéances que vous créez souvent, partagez les
                  modèles clés avec l’équipe et préremplissez vos futures obligations
                  en quelques secondes.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Logique DuePilot
                </p>
                <p className="mt-3 text-lg font-bold text-white">
                  Un modèle n’est pas une échéance active.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Il sert uniquement à réutiliser les champs utiles : catégorie,
                  rappels, récurrence, checklist, note et lien. La date et les
                  documents restent propres à chaque nouvelle échéance.
                </p>
                <Link
                  href="/deadlines/new"
                  className="mt-5 inline-flex justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400"
                >
                  Créer une échéance
                </Link>
              </div>
            </div>
          </div>
        </section>

        {templatesError ? (
          <div className="mt-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-sm leading-6 text-red-200">
            Impossible de charger la bibliothèque. Vérifiez que le SQL de la brique
            Bibliothèque d’échéances V1 a bien été exécuté dans Supabase avant de
            remplacer le dossier src.
          </div>
        ) : null}

        <div className="mt-8">
          <DeadlineTemplateManager
            initialTemplates={normalizedTemplates}
            userId={user.id}
            organizationId={userOrganization?.organization.id}
            organizationRole={userOrganization?.membership.role}
          />
        </div>
      </div>
    </main>
  );
}
