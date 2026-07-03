import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EditDeadlineForm from "@/components/EditDeadlineForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EditDeadlinePageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Deadline = {
  id: number;
  title: string;
  category: string;
  due_date: string;
  notification_days: number[] | null;
  created_at: string;
  user_id: string | null;
};

export default async function EditDeadlinePage({
  params,
}: EditDeadlinePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: deadline, error } = await supabase
    .from("deadlines")
    .select("id, title, category, due_date, notification_days, created_at, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-6 text-white sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Erreur Supabase : {error.message}
          </p>
        </div>
      </main>
    );
  }

  if (!deadline) {
    notFound();
  }

  const editableDeadline = deadline as Deadline;

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

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.035] to-blue-500/[0.06] p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
          <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
            Configuration
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            Modifier une échéance
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Ajustez les informations de {" "}
            <span className="font-semibold text-slate-200">
              {editableDeadline.title}
            </span>{" "}
            et personnalisez les rappels automatiques associés.
          </p>
        </section>

        <EditDeadlineForm deadline={editableDeadline} />
      </div>
    </main>
  );
}
