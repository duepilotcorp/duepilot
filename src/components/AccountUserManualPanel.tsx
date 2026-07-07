"use client";

import Link from "next/link";

const OPEN_ONBOARDING_EVENT = "duepilot:open-user-onboarding";

const quickGuides = [
  {
    title: "1. Commencer simplement",
    text: "Créez une première échéance avec un titre, une date, une catégorie et un rappel. Vous pourrez ajouter les détails ensuite.",
    href: "/deadlines/new",
    label: "Créer une échéance",
  },
  {
    title: "2. Centraliser les preuves",
    text: "Ajoutez les documents utiles, une checklist ou une note pour retrouver rapidement ce qui justifie le traitement.",
    href: "/deadlines",
    label: "Voir les échéances",
  },
  {
    title: "3. Anticiper les périodes sensibles",
    text: "Utilisez le calendrier conformité pour repérer les mois chargés et le dossier conformité pour préparer un contrôle.",
    href: "/deadlines/calendar",
    label: "Voir le calendrier",
  },
];

function openOnboarding() {
  window.dispatchEvent(new CustomEvent(OPEN_ONBOARDING_EVENT));
}

export default function AccountUserManualPanel() {
  return (
    <section
      id="manuel-utilisateur"
      className="scroll-mt-6 rounded-[2rem] border border-blue-400/20 bg-blue-400/10 p-6 shadow-2xl shadow-blue-950/20"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100/70">
            Aide et démarrage
          </p>
          <h2 className="mt-3 text-2xl font-bold text-white">Manuel utilisateur DuePilot</h2>
          <p className="mt-3 text-sm leading-6 text-blue-100/85">
            Retrouvez ici les bases pour utiliser DuePilot sans jargon. Vous pouvez relancer le tutoriel complet à tout moment, même si vous l'avez passé lors de votre première connexion.
          </p>
        </div>

        <button
          type="button"
          onClick={openOnboarding}
          className="inline-flex shrink-0 justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
        >
          Revoir le tutoriel
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        {quickGuides.map((guide) => (
          <div
            key={guide.title}
            className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
          >
            <h3 className="text-sm font-bold text-white">{guide.title}</h3>
            <p className="mt-2 text-sm leading-6 text-blue-100/78">{guide.text}</p>
            <Link
              href={guide.href}
              className="mt-4 inline-flex rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-blue-50 transition hover:border-blue-200/35 hover:bg-blue-400/15"
            >
              {guide.label}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-blue-100/78">
        <strong className="text-blue-50">Conseil :</strong> inutile de tout remplir dès le départ. Une échéance simple et bien datée vaut mieux qu'une organisation trop complexe dès le premier jour.
      </div>
    </section>
  );
}
