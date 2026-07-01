export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center justify-center text-center">
        <p className="mb-4 rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-200">
          DuePilot · Gestion d’échéances professionnelles
        </p>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Ne ratez plus jamais une échéance importante.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          DuePilot aide les petites entreprises à suivre leurs assurances,
          contrats, contrôles obligatoires, renouvellements et documents
          sensibles depuis un seul tableau de bord.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <a
            href="/dashboard"
            className="rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400"
          >
            Voir le dashboard
          </a>

          <a
            href="#demo"
            className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Découvrir le produit
          </a>
        </div>
      </section>
    </main>
  );
}