import { supabase } from "@/lib/supabase";

export default async function DashboardPage() {
  const { data: deadlines } = await supabase.from("deadlines").select("*");

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
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="text-sm font-medium text-blue-300 hover:text-blue-200">
          ← Retour à l’accueil
        </a>

        <h1 className="mt-8 text-4xl font-bold">Dashboard</h1>

        <p className="mt-2 text-slate-400">Bienvenue sur DuePilot.</p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
            <h2 className="text-lg font-semibold text-red-300">Échéances en retard</h2>
            <p className="mt-4 text-5xl font-bold">{lateCount}</p>
          </div>

          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-6">
            <h2 className="text-lg font-semibold text-orange-300">Dans les 30 jours</h2>
            <p className="mt-4 text-5xl font-bold">{next30Count}</p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-6">
            <h2 className="text-lg font-semibold text-green-300">Total des échéances</h2>
            <p className="mt-4 text-5xl font-bold">{total}</p>
          </div>
        </div>
      </div>
    </main>
  );
}