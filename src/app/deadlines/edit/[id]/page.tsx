import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EditDeadlineForm from "@/components/EditDeadlineForm";
import { buildDeadlineAccessOrFilter, canEditDeadline, normalizeDeadlineVisibility } from "@/lib/deadline-access";
import { getDeadlineDocumentListByDeadlineId } from "@/lib/deadline-documents-server";
import type { DeadlineChecklistItem } from "@/lib/deadline-treatment";
import { ensureUserOrganization } from "@/lib/organizations";
import { getRecurrenceShortLabel } from "@/lib/recurrence";
import { getDeadlineImportanceLabel } from "@/lib/deadline-importance";
import { getDeadlineCategoryDisplay } from "@/lib/deadline-categories";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EditDeadlinePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type Deadline = {
  id: number;
  title: string;
  category: string;
  category_key?: string | null;
  custom_category_label?: string | null;
  due_date: string;
  notification_days: number[] | null;
  recurrence_rule: string | null;
  importance_level: string | null;
  treatment_note: string | null;
  useful_link_url: string | null;
  useful_link_label: string | null;
  created_at: string;
  user_id: string | null;
  organization_id: string | null;
  visibility: string | null;
  workflow_status: string | null;
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

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(localDate);
}

export default async function EditDeadlinePage({
  params,
  searchParams,
}: EditDeadlinePageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const returnTo = getSearchParam(resolvedSearchParams, "returnTo");
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

  const { data: deadline, error } = await supabase
    .from("deadlines")
    .select(
      "id, title, category, category_key, custom_category_label, due_date, notification_days, recurrence_rule, importance_level, treatment_note, useful_link_url, useful_link_label, created_at, user_id, organization_id, visibility, workflow_status"
    )
    .eq("id", id)
    .or(
      buildDeadlineAccessOrFilter({
        userId: user.id,
        organizationId: userOrganization?.organization.id,
      })
    )
    .maybeSingle();

  if (error) {
    console.error(error);

    return (
      <main className="min-h-screen bg-slate-950 px-5 py-6 text-white sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/deadlines"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Retour aux échéances
          </Link>

          <div className="mt-8 rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
            <p className="text-lg font-bold">
              Impossible de charger cette échéance.
            </p>
            <p className="mt-2 text-sm leading-6 text-red-100/80">
              Réessayez dans quelques instants. Si le problème persiste,
              vérifiez que cette échéance existe toujours dans votre espace.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!deadline) {
    notFound();
  }

  const editableDeadline = deadline as Deadline;
  const visibility = normalizeDeadlineVisibility(editableDeadline.visibility);
  const canEditCurrentDeadline = canEditDeadline({
    visibility,
    ownerId: editableDeadline.user_id,
    userId: user.id,
    organizationRole: userOrganization?.membership.role,
    workflowStatus: editableDeadline.workflow_status,
  });

  if (!canEditCurrentDeadline) {
    redirect(`/deadlines/${editableDeadline.id}`);
  }

  const deadlineDocuments = await getDeadlineDocumentListByDeadlineId({
    supabase,
    userId: user.id,
    deadlineId: editableDeadline.id,
  });

  const { data: checklistItemsData, error: checklistItemsError } = await supabase
    .from("deadline_checklist_items")
    .select("id, deadline_id, title, is_completed, position, created_by, completed_by, completed_at, created_at, updated_at")
    .eq("deadline_id", editableDeadline.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (checklistItemsError) {
    console.error(checklistItemsError);
  }

  const checklistItems = checklistItemsError
    ? []
    : ((checklistItemsData ?? []) as DeadlineChecklistItem[]);
  const notificationCount = editableDeadline.notification_days?.length ?? 0;
  const categoryLabel = getDeadlineCategoryDisplay({
    category: editableDeadline.category,
    categoryKey: editableDeadline.category_key,
    customCategoryLabel: editableDeadline.custom_category_label,
  });
  const returnHref = returnTo === "detail" ? `/deadlines/${editableDeadline.id}` : "/deadlines";
  const returnLabel = returnTo === "detail" ? "Retour à la fiche" : "Retour aux échéances";

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-white sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href={returnHref}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        >
          <span aria-hidden="true">←</span>
          {returnLabel}
        </Link>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.035] to-blue-500/[0.06] p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
                Configuration
              </div>

              <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Modifier une échéance
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Ajustez les informations de{" "}
                <span className="font-semibold text-slate-200">
                  {editableDeadline.title}
                </span>{" "}
                et personnalisez les rappels automatiques associés.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 lg:w-80">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Échéance actuelle
              </p>
              <p className="mt-3 line-clamp-2 text-lg font-bold text-white">
                {editableDeadline.title}
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-400">
                <p>{categoryLabel}</p>
                <p>{formatDate(editableDeadline.due_date)}</p>
                <p>
                  {notificationCount > 0
                    ? `${notificationCount} rappel${
                        notificationCount === 1 ? "" : "s"
                      } configuré${notificationCount === 1 ? "" : "s"}`
                    : "Rappels par défaut"}
                </p>
                <p>Récurrence : {getRecurrenceShortLabel(editableDeadline.recurrence_rule)}</p>
                <p>Importance : {getDeadlineImportanceLabel(editableDeadline.importance_level)}</p>
                <p className="break-all leading-6">
                  {deadlineDocuments.length > 0
                    ? `${deadlineDocuments.length} document${deadlineDocuments.length > 1 ? "s" : ""} attaché${deadlineDocuments.length > 1 ? "s" : ""}`
                    : "Aucun document attaché"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <EditDeadlineForm
          deadline={editableDeadline}
          documents={deadlineDocuments}
          checklistItems={checklistItems}
          returnHref={returnHref}
        />
      </div>
    </main>
  );
}
