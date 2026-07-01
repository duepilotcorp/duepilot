import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Deadline = {
  id: number;
  title: string;
  category: string;
  due_date: string;
  created_at: string;
  user_id: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: deadlines, error } = await supabase
    .from("deadlines")
    .select("id, title, category, due_date, created_at, user_id")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true })
    .returns<Deadline[]>();

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Erreur Supabase : {error.message}
          </p>
        </div>
      </main>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total = deadlines?.length ?? 0;

  const lateCount =
    deadlines?.filter((deadline) => {
      const date = new Date(deadline.due_date);
      date.setHours(0, 0, 0, 0);
      return date < today;
    }).length ?? 0;

  const next30Count =
    deadlines?.filter((deadline) => {
      const date = new Date(deadline.due_date);
      date.setHours(0, 0, 0, 0);

      const diff = Math.ceil(
        (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return diff >= 0 && diff <= 30;
    }).length ?? 0;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-blue-300 transition hover:text-blue-200"
          >
            ← Retour à l’accueil
          </Link>

          <LogoutButton />
        </div>

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-300">
              Connecté : {user.email}
            </p>

            <h1 className="mt-3 text-4xl font-bold">Dashboard</h1>

            <p className="mt-2 text-slate-400">Bienvenue sur DuePilot.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/deadlines"
              className="inline-flex justify-center rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400"
            >
              Voir mes échéances
            </Link>

            <Link
              href="/deadlines/new"
              className="inline-flex justify-center rounded-xl bg-slate-800 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Nouvelle échéance
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
            <h2 className="text-lg font-semibold text-red-300">
              Échéances en retard
            </h2>
            <p className="mt-4 text-5xl font-bold">{lateCount}</p>
          </div>

          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-6">
            <h2 className="text-lg font-semibold text-orange-300">
              Dans les 30 jours
            </h2>
            <p className="mt-4 text-5xl font-bold">{next30Count}</p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-6">
            <h2 className="text-lg font-semibold text-green-300">
              Total des échéances
            </h2>
            <p className="mt-4 text-5xl font-bold">{total}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
