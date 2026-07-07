export default function AccountSecurityAssurancePanel() {
  const protections = [
    {
      title: "Documents privés",
      description:
        "Chaque document reste privé : l’accès est vérifié avant chaque affichage et chaque téléchargement.",
    },
    {
      title: "Isolation par compte et entreprise",
      description:
        "Vos échéances personnelles restent visibles uniquement par vous. Les échéances d’équipe restent réservées aux membres autorisés.",
    },
    {
      title: "Rôles verrouillés",
      description:
        "Les actions importantes sont limitées selon le rôle de chacun : propriétaire, administrateur, membre ou lecteur.",
    },
    {
      title: "Défense en profondeur",
      description:
        "Les contrôles sont appliqués à plusieurs niveaux pour éviter qu’un utilisateur accède à des informations qui ne lui sont pas destinées.",
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
            Vos données restent privées, organisées et protégées.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            DuePilot vérifie les accès aux échéances, aux documents et aux espaces
            d’équipe afin que chacun voie uniquement les informations auxquelles il
            est autorisé. Vous pouvez centraliser vos documents sensibles dans un
            espace clair, privé et maîtrisé.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300 lg:w-80">
          <p className="font-semibold text-white">Bonnes pratiques</p>
          <p className="mt-2 leading-6 text-slate-400">
            Utilisez un mot de passe unique, limitez les accès administrateur et
            retirez rapidement les membres qui ne doivent plus accéder à votre espace entreprise.
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
