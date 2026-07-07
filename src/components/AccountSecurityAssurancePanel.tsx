export default function AccountSecurityAssurancePanel() {
  const protections = [
    {
      title: "Documents privés",
      description:
        "Les documents sont servis par une route contrôlée côté serveur : chaque affichage et téléchargement vérifie la session et les droits sur l’échéance.",
    },
    {
      title: "Isolation par compte et entreprise",
      description:
        "Les échéances personnelles restent liées à leur créateur. Les échéances équipe restent limitées aux membres actifs de l’organisation.",
    },
    {
      title: "Rôles verrouillés",
      description:
        "Les actions sensibles restent réservées aux bons profils : owner, admin, membre assigné ou lecteur selon le contexte.",
    },
    {
      title: "Défense en profondeur",
      description:
        "Les protections sont appliquées dans l’interface, côté serveur et au niveau Supabase avec des règles RLS dédiées.",
    },
  ];

  return (
    <section className="rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 via-white/[0.035] to-blue-500/10 p-6 shadow-2xl shadow-emerald-950/10 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            Espace sécurisé
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Vos données restent cloisonnées et contrôlées.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            DuePilot applique des contrôles d’accès stricts pour limiter chaque
            utilisateur à ses propres informations ou à celles de son équipe
            autorisée. L’objectif : donner un cadre fiable pour centraliser vos
            échéances et documents sensibles.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300 lg:w-80">
          <p className="font-semibold text-white">Bonnes pratiques</p>
          <p className="mt-2 leading-6 text-slate-400">
            Utilisez un mot de passe unique, limitez les rôles admin et retirez
            rapidement les membres qui ne doivent plus accéder à l’entreprise.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {protections.map((protection) => (
          <div
            key={protection.title}
            className="rounded-3xl border border-white/10 bg-slate-950/45 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xs font-black text-slate-950">
                ✓
              </span>
              <div>
                <h3 className="font-bold text-white">{protection.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {protection.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
