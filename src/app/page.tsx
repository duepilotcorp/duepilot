import Link from "next/link";

const trustSignals = [
  "Échéances réglementaires",
  "Rappels personnalisables",
  "Dashboard temps réel",
  "Isolation des données",
];

const risks = [
  {
    title: "Certifications expirées",
    description:
      "Gardez une vision claire sur les qualifications, habilitations et documents à renouveler.",
  },
  {
    title: "Contrats oubliés",
    description:
      "Anticipez les reconductions, renouvellements et dates clés avant qu’elles ne deviennent urgentes.",
  },
  {
    title: "Contrôles obligatoires",
    description:
      "Suivez les vérifications périodiques, assurances, entretiens et obligations de conformité.",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Centralisez",
    description:
      "Ajoutez vos échéances sensibles dans un espace unique, propre et lisible.",
  },
  {
    step: "02",
    title: "Priorisez",
    description:
      "Identifiez immédiatement les échéances en retard, à venir ou sous contrôle.",
  },
  {
    step: "03",
    title: "Anticipez",
    description:
      "Recevez les bons rappels au bon moment selon le niveau de criticité.",
  },
];

const features = [
  "Vue cockpit des risques administratifs",
  "Recherche, filtres et tri des échéances",
  "Rappels à J-30, J-15, J-7, J-3, J-1 et jour J",
  "Historique technique des notifications",
  "Accès sécurisé avec données isolées par utilisateur",
  "Interface pensée pour les dirigeants et équipes administratives",
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <section className="relative border-b border-white/10 px-6 py-6 sm:px-8 lg:px-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#020617_100%)]" />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-300/25 bg-blue-400/10 shadow-[0_0_40px_rgba(59,130,246,0.18)]">
              <span className="h-4 w-4 rounded-full bg-blue-300 shadow-[0_0_24px_rgba(147,197,253,0.85)]" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[0.28em] text-blue-100">
                DUEPILOT
              </span>
              <span className="hidden text-xs text-slate-400 sm:block">
                Copilote administratif B2B
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#produit" className="transition hover:text-white">
              Produit
            </a>
            <a href="#fonctionnement" className="transition hover:text-white">
              Fonctionnement
            </a>
            <a href="#securite" className="transition hover:text-white">
              Sécurité
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-2xl shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-50"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </section>

      <section className="relative px-6 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:px-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.16),transparent_38%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-100 shadow-[0_0_40px_rgba(59,130,246,0.10)]">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)]" />
              Beta privée · SaaS de suivi réglementaire
            </div>

            <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              Le copilote administratif qui empêche les échéances critiques de
              vous rattraper.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl sm:leading-9">
              DuePilot centralise assurances, certifications, contrats,
              habilitations et contrôles obligatoires pour aider les entreprises
              à anticiper les risques avant qu’ils ne deviennent des urgences.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-blue-500 px-6 py-4 text-sm font-semibold text-white shadow-2xl shadow-blue-500/25 transition hover:-translate-y-0.5 hover:bg-blue-400"
              >
                Démarrer la beta privée
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Accéder à mon espace
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {trustSignals.map((signal) => (
                <div
                  key={signal}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/10 text-xs text-emerald-200">
                    ✓
                  </span>
                  {signal}
                </div>
              ))}
            </div>
          </div>

          <div id="produit" className="relative">
            <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-blue-500/10 blur-3xl" />
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/90 p-5">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
                      Cockpit DuePilot
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      Risque administratif
                    </h2>
                  </div>
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    Sous contrôle
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
                    <p className="text-xs text-red-100/80">En retard</p>
                    <p className="mt-3 text-3xl font-semibold text-red-100">0</p>
                  </div>
                  <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                    <p className="text-xs text-yellow-100/80">30 jours</p>
                    <p className="mt-3 text-3xl font-semibold text-yellow-100">4</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <p className="text-xs text-emerald-100/80">Total</p>
                    <p className="mt-3 text-3xl font-semibold text-emerald-100">28</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Certification Qualité ISO
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        À traiter dans 7 jours · Rappel J-7 actif
                      </p>
                    </div>
                    <span className="rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-100">
                      Critique
                    </span>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Assurance responsabilité civile
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        À traiter dans 24 jours · Rappel J-30 envoyé
                      </p>
                    </div>
                    <span className="rounded-full border border-blue-400/25 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">
                      Planifié
                    </span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
                  <p className="text-sm font-medium text-blue-100">
                    DuePilot détecte les prochaines priorités et vous aide à
                    agir avant le retard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03] px-6 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
              Problème traité
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Les oublis administratifs coûtent cher. DuePilot les rend visibles.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {risks.map((risk) => (
              <article
                key={risk.title}
                className="rounded-[1.7rem] border border-white/10 bg-slate-950/70 p-6 shadow-xl shadow-black/20"
              >
                <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-400/10 text-blue-100">
                  →
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {risk.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-400">
                  {risk.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="fonctionnement" className="px-6 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
              Méthode
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Un système simple pour garder le contrôle.
            </h2>
            <p className="mt-5 max-w-xl leading-8 text-slate-400">
              DuePilot ne cherche pas à complexifier votre organisation. Le
              produit vous donne une vision claire : ce qui est en retard, ce
              qui arrive bientôt, et ce qui est sous contrôle.
            </p>
          </div>

          <div className="grid gap-4">
            {workflowSteps.map((item) => (
              <div
                key={item.step}
                className="grid gap-5 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 sm:grid-cols-[auto_1fr]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/25 bg-blue-400/10 text-sm font-semibold text-blue-100">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 leading-7 text-slate-400">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="securite" className="px-6 pb-24 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
                Beta privée
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Une base pensée pour devenir un vrai SaaS B2B.
              </h2>
              <p className="mt-5 leading-8 text-slate-400">
                Authentification, isolation des données, rappels configurables,
                cron sécurisé et historique technique : le socle est conçu pour
                évoluer proprement vers une version commerciale.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300"
                >
                  <span className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/10 text-xs text-emerald-200">
                    ✓
                  </span>
                  <p>{feature}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
              DuePilot
            </p>
            <p className="mt-2 max-w-xl text-slate-400">
              Centralisez, suivez et anticipez les échéances administratives de
              votre entreprise.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="rounded-2xl bg-blue-500 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              Créer un compte
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-white/15 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
