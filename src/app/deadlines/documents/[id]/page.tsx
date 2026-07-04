import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatFileSize } from "@/lib/deadline-documents";
import { getDeadlineDocumentById } from "@/lib/deadline-documents-server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DeadlineDocumentViewerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DeadlineDocumentViewerPage({
  params,
}: DeadlineDocumentViewerPageProps) {
  const { id } = await params;
  const documentId = Number(id);

  if (!Number.isInteger(documentId) || documentId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const document = await getDeadlineDocumentById({
    supabase,
    userId: user.id,
    documentId,
  });

  if (!document) {
    notFound();
  }

  const viewerUrl = `/api/deadline-documents/${document.id}`;
  const viewerEmbedUrl = `${viewerUrl}#toolbar=1&navpanes=0&scrollbar=1`;
  const downloadUrl = `/api/deadline-documents/${document.id}?download=1`;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-white sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/deadlines/${document.deadline_id}`}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Retour à l’échéance
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/deadlines/edit/${document.deadline_id}`}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
            >
              Modifier l’échéance
            </Link>
            <a
              href={downloadUrl}
              className="rounded-xl border border-blue-400/25 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:border-blue-300/50 hover:bg-blue-400/15 hover:text-white"
            >
              Télécharger
            </a>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.035] to-blue-500/[0.06] shadow-2xl shadow-slate-950/40">
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                Document sécurisé
              </div>
              <h1 className="mt-4 break-words text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {document.file_name}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Aperçu PDF intégré à DuePilot. Le fichier reste lié à votre
                espace utilisateur et à son échéance.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-400 lg:min-w-72">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Informations
              </p>
              <div className="mt-3 space-y-2">
                <p>
                  Format : <span className="font-semibold text-slate-200">PDF</span>
                </p>
                <p>
                  Taille :{" "}
                  <span className="font-semibold text-slate-200">
                    {formatFileSize(document.file_size)}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/70 p-3 sm:p-4">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-slate-950/40">
              <object
                data={viewerEmbedUrl}
                type="application/pdf"
                className="h-[72vh] w-full bg-white"
                aria-label={`Aperçu PDF — ${document.file_name}`}
              >
                <div className="flex h-[72vh] w-full flex-col items-center justify-center bg-white px-6 text-center text-slate-700">
                  <p className="text-base font-semibold">
                    L’aperçu PDF ne peut pas être affiché dans ce navigateur.
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Utilisez le bouton Télécharger pour ouvrir le document avec
                    votre lecteur PDF.
                  </p>
                  <a
                    href={downloadUrl}
                    className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Télécharger le PDF
                  </a>
                </div>
              </object>
            </div>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Si l’aperçu ne s’affiche pas sur votre navigateur, utilisez le
              bouton Télécharger en haut de la page.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
