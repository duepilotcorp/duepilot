import Link from "next/link";

type DeadlineOnboardingEmptyStateProps = {
  embedded?: boolean;
  variant?: "dashboard" | "deadlines";
};

const onboardingSteps = [
  {
    number: "01",
    title: "Listez vos obligations critiques",
    description:
      "Commencez par les documents dont l’oubli peut créer une pénalité, une perte de couverture ou une non-conformité.",
  },
  {
    number: "02",
    title: "Ajoutez une date et des rappels",
    description:
      "Définissez l’échéance réelle puis choisissez les alertes utiles : J-30, J-15, J-7, J-3, J-1 ou Jour J.",
  },
  {
    number: "03",
    title: "Laissez DuePilot prioriser",
    description:
      "Le dashboard classe automatiquement ce qui est en retard, proche ou sous contrôle pour guider vos actions.",
  },
];

const starterDeadlines = [
  {
    title: "Assurance RC Pro",
    category: "Assurance",
    hint: "À renouveler avant expiration du contrat.",
  },
  {
    title: "Attestation décennale",
    category: "Assurance",
    hint: "Indispensable pour les entreprises du bâtiment.",
  },
  {
    title: "Certification RGE / QUALIBAT",
    category: "Certification",
    hint: "À suivre pour éviter une perte de qualification.",
  },
  {
    title: "Contrôle extincteurs",
    category: "Contrôle réglementaire",
    hint: "Vérification périodique à planifier.",
  },
  {
    title: "Vérification électrique",
    category: "Sécurité",
    hint: "Contrôle obligatoire selon l’activité et les locaux.",
  },
  {
    title: "Contrat fournisseur critique",
    category: "Contrat",
    hint: "Anticiper renouvellement, résiliation ou renégociation.",
  },
];

export default function DeadlineOnboardingEmptyState({
  embedded = false,
  variant = "dashboard",
}: DeadlineOnboardingEmptyStateProps) {
  const containerClassName = embedded
    ? "p-5 sm:p-8 lg:p-10"
    : "mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20 sm:p-8 lg:p-10";

  const headline =
    variant === "dashboard"
      ? "Configurez votre cockpit en moins de 3 minutes."
      : "Créez votre premier registre d’échéances.";

  const description =
    variant === "dashboard"
      ? "Ajoutez quelques obligations clés : DuePilot générera ensuite les priorités, le score de suivi et les prochaines actions à traiter."
      : "Démarrez avec les échéances qui ont le plus d’impact sur votre conformité, vos assurances et la continuité de votre activité.";

  return (
    <div className={containerClassName}>
      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
        <div>
          <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
            Onboarding beta privée
          </div>

          <h2 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {headline}
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            {description}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/deadlines/new"
              className="inline-flex justify-center rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              Ajouter une première échéance
            </Link>
            <Link
              href="/deadlines"
              className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white"
            >
              Voir le registre
            </Link>
          </div>

          <div className="mt-8 grid gap-3">
            {onboardingSteps.map((step) => (
              <div
                key={step.number}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/10 text-xs font-bold text-blue-100">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-5 shadow-xl shadow-slate-950/20 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">
                Échéances recommandées
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Quelques exemples concrets pour remplir rapidement votre premier registre.
              </p>
            </div>
            <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              Démarrage rapide
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {starterDeadlines.map((deadline) => (
              <Link
                key={`${deadline.title}-${deadline.category}`}
                href="/deadlines/new"
                className="group rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-blue-400/40 hover:bg-blue-400/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white transition group-hover:text-blue-100">
                      {deadline.title}
                    </p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200/80">
                      {deadline.category}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-slate-500 transition group-hover:text-blue-100">
                    +
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {deadline.hint}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-blue-400/20 bg-blue-400/10 p-4">
            <p className="text-sm font-semibold text-blue-100">
              Conseil beta
            </p>
            <p className="mt-2 text-sm leading-6 text-blue-100/75">
              Ajoutez d’abord 3 à 5 échéances réelles. Vous verrez immédiatement le dashboard se transformer en cockpit opérationnel.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
