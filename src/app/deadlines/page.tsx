import Link from "next/link";
import { redirect } from "next/navigation";
import DeleteDeadlineButton from "@/components/DeleteDeadlineButton";
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

function getDeadlineStatus(dueDate: string) {
  const today = new Date();
  const deadlineDate = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);

  const differenceInTime = deadlineDate.getTime() - today.getTime();
  const differenceInDays = Math.ceil(differenceInTime / (1000 * 60 * 60 * 24));

  if (differenceInDays < 0) {
    return `En retard de ${Math.abs(differenceInDays)} jour(s)`;
  }

  if (differenceInDays === 0) {
    return "Aujourd'hui";
  }

  return `${differenceInDays} jour(s) restant(s)`;
}

function getDeadlineStatusColor(dueDate: string) {
  const today = new Date();
  const deadlineDate = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);

  const differenceInDays = Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (differenceInDays < 0) return "text-red-400";
  if (differenceInDays <= 7) return "text-orange-400";
  if (differenceInDays <= 30) return "text-yellow-400";

  return "text-green-400";
}

export default async function DeadlinesPage() {
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

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-blue-300 transition hover:text-blue-200"
          >
            ← Retour au dashboard
          </Link>

          <LogoutButton />
        </div>

        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold">Mes échéances</h1>
            <p className="mt-2 text-slate-400">
              Retrouvez ici toutes les échéances de votre entreprise.
            </p>
          </div>

          <Link
            href="/deadlines/new"
            className="inline-flex justify-center rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400"
          >
            + Nouvelle échéance
          </Link>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-800 text-left">
                <tr>
                  <th className="p-4">Nom</th>
                  <th className="p-4">Catégorie</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {deadlines?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center">
                      <p className="text-lg font-semibold text-white">
                        Aucune échéance pour le moment
                      </p>

                      <p className="mt-2 text-slate-400">
                        Ajoutez votre première échéance pour commencer à suivre
                        vos obligations importantes.
                      </p>

                      <Link
                        href="/deadlines/new"
                        className="mt-6 inline-flex rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400"
                      >
                        Créer ma première échéance
                      </Link>
                    </td>
                  </tr>
                )}

                {deadlines?.map((deadline) => (
                  <tr key={deadline.id} className="border-t border-white/10">
                    <td className="p-4 font-medium text-white">
                      {deadline.title}
                    </td>
                    <td className="p-4 text-slate-300">{deadline.category}</td>
                    <td className="p-4 text-slate-300">
                      {new Date(deadline.due_date).toLocaleDateString("fr-FR")}
                    </td>
                    <td
                      className={`p-4 font-medium ${getDeadlineStatusColor(
                        deadline.due_date
                      )}`}
                    >
                      {getDeadlineStatus(deadline.due_date)}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Link
                          href={`/deadlines/edit/${deadline.id}`}
                          className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-400"
                        >
                          Modifier
                        </Link>

                        <DeleteDeadlineButton id={deadline.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
