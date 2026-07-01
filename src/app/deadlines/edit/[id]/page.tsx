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
    .select("id, title, category, due_date, created_at, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
        <div className="mx-auto max-w-2xl">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
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
    <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/deadlines"
          className="text-sm font-medium text-blue-300 transition hover:text-blue-200"
        >
          ← Retour aux échéances
        </Link>

        <h1 className="mt-8 text-4xl font-bold">Modifier une échéance</h1>

        <p className="mt-2 text-slate-400">Modification de : {editableDeadline.title}</p>

        <EditDeadlineForm deadline={editableDeadline} />
      </div>
    </main>
  );
}
