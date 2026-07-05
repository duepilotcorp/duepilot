import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const heroMetrics = [
  { label: "Échéances suivies", value: "128" },
  { label: "Documents associés", value: "84" },
  { label: "Actions à traiter", value: "3" },
];

const priorityItems = [
  {
    name: "Certification RGE / QUALIBAT",
    meta: "À traiter dans 7 jours",
    status: "Critique",
    tone: "border-orange-300/25 bg-orange-400/10 text-orange-100",
  },
  {
    name: "Assurance responsabilité civile",
    meta: "Renouvellement dans 24 jours",
    status: "Planifié",
    tone: "border-blue-300/25 bg-blue-400/10 text-blue-100",
  },
  {
    name: "Contrôle extincteurs",
    meta: "Rappel automatique activé",
    status: "Suivi",
    tone: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  },
];

const useCases = [
  {
    title: "Assurances et contrats",
    description:
      "Regroupez les dates clés, attestations et renouvellements pour éviter les oublis coûteux.",
  },
  {
    title: "Certifications et habilitations",
    description:
      "Gardez une vue claire sur les qualifications professionnelles et documents sensibles.",
  },
  {
    title: "Contrôles réglementaires",
    description:
      "Suivez les vérifications périodiques, rapports, entretiens et obligations de conformité.",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Centralisez vos obligations",
    description:
      "Créez vos échéances, ajoutez les documents associés et structurez vos priorités dans un espace unique.",
  },
  {
    step: "02",
    title: "Anticipez les risques",
    description:
      "Visualisez les urgences, les dates à venir et les échéances sous contrôle en quelques secondes.",
  },
  {
    step: "03",
    title: "Renouvelez sans perdre l’historique",
    description:
      "Clôturez une obligation traitée, renseignez la prochaine date et conservez la trace des actions.",
  },
];

const capabilities = [
  "Dashboard de suivi",
  "Rappels personnalisables",
  "Documents associés",
  "Modèles par secteur",
  "Journal d’activité",
  "Renouvellement d’échéance",
  "Recherche et filtres",
  "Données isolées par utilisateur",
];

const trustItems = [
  {
    title: "Lecture immédiate",
    description:
      "Les priorités ressortent clairement : retard, urgence, document associé et prochaine action.",
  },
  {
    title: "Suivi documenté",
    description:
      "Chaque échéance peut conserver son document, ses rappels et son journal d’activité.",
  },
  {
    title: "Base sécurisée",
    description:
      "L’accès est protégé et les données utilisateur restent isolées dans l’espace applicatif.",
  },
];

type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: HomeSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const recoveryCode = getSearchParamValue(resolvedSearchParams.code);

  if (recoveryCode) {
    redirect(`/reset-password?code=${encodeURIComponent(recoveryCode)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(user);

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)]" />

      <header className="relative z-20 border-b border-white/10 bg-slate-950/70 px-6 py-5 backdrop-blur-xl sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <Link href="/" className="group flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-300/25 bg-blue-400/10 shadow-[0_0_40px_rgba(59,130,246,0.18)] transition group-hover:border-blue-200/40 group-hover:bg-blue-400/15">
              <span className="absolute h-6 w-6 rounded-full border border-blue-200/20" />
              <span className="h-3 w-3 rounded-full bg-blue-300 shadow-[0_0_24px_rgba(147,197,253,0.85)]" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[0.28em] text-blue-100">
                DUEPILOT
              </span>
              <span className="hidden text-xs text-slate-400 sm:block">
                Copilote administratif
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#solution" className="transition hover:text-white">
              Solution
            </a>
            <a href="#pilotage" className="transition hover:text-white">
              Pilotage
            </a>
            <a href="#securite" className="transition hover:text-white">
              Sécurité
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-2xl shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-50"
                >
                  Accéder à mon espace
                </Link>
                <div className="hidden sm:block">
                  <LogoutButton />
                </div>
              </>
            ) : (
              <>
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
                  Demander un accès
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative px-6 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:px-10">
        <div className="pointer-events-none absolute left-1/2 top-10 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl animate-soft-pulse" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.97fr_1.03fr]">
          <div className="animate-rise-in">
            <div className="inline-flex items-center gap-3 rounded-full border border-blue-300/25 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-100 shadow-[0_0_40px_rgba(59,130,246,0.10)]">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)]" />
              Suivi administratif intelligent
            </div>

            <h1 className="mt-7 max-w-5xl text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
              Anticipez vos échéances avant qu’elles ne deviennent des urgences.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl sm:leading-9">
              DuePilot aide les entreprises à piloter leurs assurances,
              certifications, contrats, contrôles et documents sensibles dans un
              espace clair, sécurisé et actionnable.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href={isAuthenticated ? "/dashboard" : "/register"}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-500 px-6 py-4 text-sm font-semibold text-white shadow-2xl shadow-blue-500/25 transition hover:-translate-y-0.5 hover:bg-blue-400"
              >
                {isAuthenticated ? "Accéder à mon espace" : "Demander un accès"}
              </Link>
              <Link
                href={isAuthenticated ? "/deadlines" : "/login"}
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                {isAuthenticated ? "Voir mes échéances" : "Se connecter"}
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-blue-300/20 hover:bg-white/[0.06]"
                >
                  <p className="text-2xl font-semibold text-white">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div id="solution" className="relative animate-rise-in-delay-1">
            <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-blue-500/10 blur-3xl animate-soft-pulse" />
            <div className="absolute -right-6 top-10 hidden h-24 w-24 rounded-full border border-blue-200/10 lg:block animate-float-slow" />
            <div className="premium-sheen rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/90 p-5">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
                      Cockpit DuePilot
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      Priorités administratives
                    </h2>
                  </div>
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    Suivi actif
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
                    <p className="text-xs text-red-100/80">En retard</p>
                    <p className="mt-3 text-3xl font-semibold text-red-100">0</p>
                  </div>
                  <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                    <p className="text-xs text-yellow-100/80">À 30 jours</p>
                    <p className="mt-3 text-3xl font-semibold text-yellow-100">4</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <p className="text-xs text-emerald-100/80">Avec document</p>
                    <p className="mt-3 text-3xl font-semibold text-emerald-100">21</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {priorityItems.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-blue-300/20 hover:bg-white/[0.06]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {item.meta}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.tone}`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
                  <p className="text-sm font-medium leading-6 text-blue-100">
                    Une vue unique pour savoir quoi traiter, quand relancer et
                    quel document consulter.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03] px-6 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-3">
            {trustItems.map((item, index) => (
              <article
                key={item.title}
                className="rounded-[1.7rem] border border-white/10 bg-slate-950/70 p-6 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-blue-300/20 hover:bg-slate-900/80"
              >
                <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-400/10 text-sm font-semibold text-blue-100">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-400">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pilotage" className="px-6 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-10">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
              Pilotage
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Du rappel à l’action, sans perdre le fil.
            </h2>
            <p className="mt-5 max-w-xl leading-8 text-slate-400">
              DuePilot ne se limite pas à stocker une date. Chaque échéance peut
              être suivie, documentée, renouvelée et historisée.
            </p>
          </div>

          <div className="grid gap-4">
            {workflowSteps.map((item) => (
              <div
                key={item.step}
                className="grid gap-5 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-blue-300/20 hover:bg-white/[0.06] sm:grid-cols-[auto_1fr]"
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

      <section className="px-6 pb-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
              Cas d’usage
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Une seule base pour les obligations qui ne doivent pas être oubliées.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {useCases.map((useCase) => (
              <article
                key={useCase.title}
                className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-blue-300/20 hover:bg-white/[0.06]"
              >
                <div className="mb-8 h-1.5 w-12 rounded-full bg-blue-300/70" />
                <h3 className="text-lg font-semibold text-white">
                  {useCase.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-400">
                  {useCase.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="securite" className="px-6 pb-24 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/25 sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
                Fonctionnalités
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Les outils essentiels pour piloter vos échéances critiques.
              </h2>
              <p className="mt-5 leading-8 text-slate-400">
                DuePilot rassemble les informations utiles autour de chaque
                obligation : date, priorité, document, rappels, historique et
                prochain cycle de suivi.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {capabilities.map((feature) => (
                <div
                  key={feature}
                  className="group rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300 transition hover:-translate-y-0.5 hover:border-emerald-300/20 hover:bg-slate-900"
                >
                  <span className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 transition group-hover:scale-125" />
                  </span>
                  <p>{feature}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.2rem] border border-blue-300/20 bg-blue-500/10 p-6 shadow-2xl shadow-blue-950/20 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-100">
                Accès sur demande
              </p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Mettez vos échéances sensibles sous contrôle.
              </h2>
              <p className="mt-5 max-w-2xl leading-8 text-blue-50/75">
                Reprenez la main sur les dates, documents et actions qui
                protègent votre activité.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href={isAuthenticated ? "/dashboard" : "/register"}
                className="rounded-2xl bg-white px-6 py-4 text-center text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-blue-50"
              >
                {isAuthenticated ? "Accéder à mon espace" : "Demander un accès"}
              </Link>
              <Link
                href={isAuthenticated ? "/deadlines" : "/login"}
                className="rounded-2xl border border-white/20 px-6 py-4 text-center text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                {isAuthenticated ? "Voir mes échéances" : "Se connecter"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10 sm:px-8 lg:px-10">
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
          <p className="text-sm text-slate-500">
            Copilote administratif pour entreprises exigeantes.
          </p>
        </div>
      </footer>
    </main>
  );
}
