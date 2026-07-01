import EditDeadlineForm from "@/components/EditDeadlineForm";
import { supabase } from "@/lib/supabase";

type EditDeadlinePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditDeadlinePage({
  params,
}: EditDeadlinePageProps) {
  const { id } = await params;

  const { data: deadline } = await supabase
  .from("deadlines")
  .select("*")
  .eq("id", id)
  .single();


  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-2xl">
        <a
          href="/deadlines"
          className="text-sm font-medium text-blue-300 hover:text-blue-200"
        >
          ← Retour aux échéances
        </a>

        <h1 className="mt-8 text-4xl font-bold">
          Modifier une échéance
        </h1>

        <p className="mt-2 text-slate-400">
            Modification de : {deadline?.title}
        </p>

        <EditDeadlineForm deadline={deadline} />

      </div>
    </main>
  );
}