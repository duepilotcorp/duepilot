import { supabase } from "@/lib/supabase";

import DeleteDeadlineButton from "@/components/DeleteDeadlineButton";

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
  const { data: deadlines, error } = await supabase
    .from("deadlines")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) {
  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <p className="text-red-400">
        Erreur Supabase : {error.message}
      </p>
    </main>
  );
}

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <a href="/dashboard" className="text-sm font-medium text-blue-300 hover:text-blue-200">
          ← Retour au dashboard
        </a>

        <div className="mt-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Mes échéances</h1>
            <p className="mt-2 text-slate-400">
              Retrouvez ici toutes les échéances de votre entreprise.
            </p>
          </div>

          <a
            href="/deadlines/new"
            className="rounded-xl bg-blue-500 px-5 py-3 font-semibold hover:bg-blue-400"
          >
            + Nouvelle échéance
          </a>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <table className="w-full">
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
        Ajoutez votre première échéance pour commencer à suivre vos obligations importantes.
      </p>

      <a
        href="/deadlines/new"
        className="mt-6 inline-flex rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white hover:bg-blue-400"
      >
        Créer ma première échéance
      </a>
    </td>
  </tr>
)}
              {deadlines?.map((deadline) => (
                <tr key={deadline.id} className="border-t border-white/10">
                <td className="p-4">{deadline.title}</td>
                <td className="p-4">{deadline.category}</td>
                <td className="p-4">
                {new Date(deadline.due_date).toLocaleDateString("fr-FR")}
                </td>
                  <td className={`p-4 font-medium ${getDeadlineStatusColor(deadline.due_date)}`}>
                {getDeadlineStatus(deadline.due_date)}
                </td>
                <td className="p-4">
  <div className="flex gap-2">
    <a
      href={`/deadlines/edit/${deadline.id}`}
      className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-400"
    >
      Modifier
    </a>

    <DeleteDeadlineButton id={deadline.id} />
  </div>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}