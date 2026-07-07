"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ONBOARDING_STORAGE_KEY = "duepilot:user-onboarding:v1:completed";
const OPEN_ONBOARDING_EVENT = "duepilot:open-user-onboarding";

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/deadlines",
  "/settings",
  "/admin",
  "/team",
] as const;

const ONBOARDING_EXCLUDED_ROUTE_PREFIXES = ["/team/invitations"] as const;

type OnboardingStep = {
  eyebrow: string;
  title: string;
  description: string;
  details: string[];
  example: string;
  nextAction: string;
};

const onboardingSteps: OnboardingStep[] = [
  {
    eyebrow: "Bienvenue",
    title: "DuePilot vous aide à ne plus oublier vos échéances importantes.",
    description:
      "L'application rassemble vos dates importantes, vos documents et vos actions dans un espace clair, organisé et sécurisé.",
    details: [
      "Une échéance peut être une assurance, un contrat, un contrôle, une certification ou un document à renouveler.",
      "Vous pouvez commencer très simplement : un titre, une date et un rappel suffisent.",
      "Le tutoriel reste accessible à tout moment depuis Mon compte, en bas de page.",
    ],
    example:
      "Exemple : ajoutez “Assurance RC Pro” avec sa date de renouvellement. DuePilot vous aide ensuite à ne pas la rater.",
    nextAction:
      "Après le tutoriel, créez une seule échéance simple. Vous pourrez enrichir le reste plus tard.",
  },
  {
    eyebrow: "Dashboard",
    title: "Le dashboard vous donne la vue d'ensemble.",
    description:
      "C'est la page à consulter en premier pour savoir rapidement si tout va bien ou si une action mérite votre attention.",
    details: [
      "Le score de risque indique si des échéances demandent une action rapide.",
      "Les cartes mettent en avant les retards, les urgences et les validations en attente.",
      "Les raccourcis vous orientent vers les pages les plus utiles sans chercher dans les menus.",
    ],
    example:
      "Exemple : si une échéance approche dans les prochains jours, le dashboard la fait ressortir pour que vous puissiez agir plus vite.",
    nextAction: "Revenez au dashboard dès que vous voulez une vue simple de la situation.",
  },
  {
    eyebrow: "Créer",
    title: "Créer une échéance, c'est enregistrer une obligation à suivre.",
    description:
      "Vous ajoutez une date, une catégorie, un niveau d'importance et des rappels. DuePilot vous aide ensuite à anticiper.",
    details: [
      "Une échéance personnelle reste visible uniquement par vous.",
      "Une échéance équipe sert à coordonner le travail avec votre organisation.",
      "La récurrence prépare plus facilement les renouvellements qui reviennent souvent.",
    ],
    example:
      "Exemple : “Contrôle extincteurs”, catégorie “Contrôle réglementaire”, importance “Important”, rappel 30 jours avant.",
    nextAction:
      "Après le tutoriel, utilisez “Nouvelle échéance” et créez une obligation réelle ou de test.",
  },
  {
    eyebrow: "Preuves",
    title: "Ajoutez les documents et les informations utiles au même endroit.",
    description:
      "Une fiche échéance peut contenir des PDF, des images, une checklist, des notes de traitement et des liens utiles.",
    details: [
      "Les documents servent à retrouver rapidement une preuve, une attestation ou un justificatif.",
      "La checklist détaille les actions à faire avant de marquer l'échéance comme traitée.",
      "L'historique garde une trace claire des actions importantes réalisées sur l'échéance.",
    ],
    example:
      "Exemple : ajoutez l'attestation d'assurance en PDF, puis une checklist “vérifier, transmettre, archiver”.",
    nextAction:
      "Commencez léger : ajoutez un document seulement si l'échéance a vraiment besoin d'une preuve.",
  },
  {
    eyebrow: "Modèles",
    title: "La bibliothèque vous évite de recréer les mêmes échéances.",
    description:
      "Vous pouvez enregistrer vos propres modèles puis les réutiliser quand une obligation similaire revient.",
    details: [
      "Un modèle peut reprendre la catégorie, l'importance, les rappels, la récurrence et les consignes.",
      "Les modèles personnels restent pour vous. Les modèles équipe peuvent être partagés selon votre rôle.",
      "C'est pratique pour les obligations récurrentes : contrats, assurances, contrôles, RH ou fournisseurs.",
    ],
    example:
      "Exemple : créez un modèle “Renouvellement contrat fournisseur” et réutilisez-le pour chaque nouveau contrat.",
    nextAction:
      "Après avoir créé une bonne échéance, ouvrez sa fiche puis utilisez “Enregistrer comme modèle”.",
  },
  {
    eyebrow: "Équipe",
    title: "Le workflow aide à savoir qui fait quoi.",
    description:
      "Une échéance équipe peut être prise en charge par un membre, puis validée par un admin quand elle est terminée.",
    details: [
      "Les membres peuvent signaler qu'ils travaillent sur une échéance.",
      "Les admins gardent le contrôle sur les validations importantes.",
      "Les échéances personnelles restent simples : une fois traitées, elles passent directement dans l'historique.",
    ],
    example:
      "Exemple : un membre traite une habilitation, puis l'admin vérifie et valide avant archivage.",
    nextAction:
      "Si vous êtes seul, utilisez d'abord les échéances personnelles. Le travail d'équipe pourra venir ensuite.",
  },
  {
    eyebrow: "Anticiper",
    title: "Le calendrier et le dossier conformité préparent les périodes sensibles.",
    description:
      "Ces vues servent à repérer les mois chargés et à préparer un contrôle, une réunion ou un audit.",
    details: [
      "Le calendrier annuel montre les périodes calmes, chargées ou critiques.",
      "Le dossier conformité rassemble les échéances, les documents disponibles et l'activité récente.",
      "L'export par impression navigateur permet de partager un dossier propre si besoin.",
    ],
    example:
      "Exemple : si septembre contient beaucoup de renouvellements, le calendrier vous aide à vous organiser avant l'urgence.",
    nextAction:
      "Quand vous aurez quelques échéances, consultez le calendrier pour voir les mois qui demandent le plus d'attention.",
  },
  {
    eyebrow: "Aide",
    title: "Vous pouvez revoir ce tutoriel à tout moment depuis Mon compte.",
    description:
      "DuePilot reste volontairement simple : si vous êtes perdu, ouvrez Mon compte puis le manuel utilisateur en bas de page.",
    details: [
      "Vous pouvez modifier votre nom, votre mot de passe et vos préférences e-mail.",
      "Le résumé hebdomadaire est optionnel et désactivable à tout moment.",
      "Le manuel utilisateur reste accessible pour revoir les bases avec des mots simples.",
    ],
    example:
      "Exemple : si vous passez ce tutoriel aujourd'hui, vous pourrez le relancer plus tard depuis Mon compte, sans rien perdre.",
    nextAction:
      "À retenir : ce tutoriel n'est jamais définitif. Vous pouvez le passer maintenant et le refaire plus tard.",
  },
];

function isProtectedPath(pathname: string | null) {
  if (!pathname) return false;

  if (
    ONBOARDING_EXCLUDED_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function getStoredCompletion() {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

function storeCompletion() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // Le tutoriel doit rester utilisable même si le stockage local est bloqué.
  }
}

export default function UserOnboardingExperience() {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [acknowledgedSteps, setAcknowledgedSteps] = useState<number[]>([]);
  const isOpenRef = useRef(false);
  const currentStepIndexRef = useRef(0);

  const currentStep = onboardingSteps[currentStepIndex] ?? onboardingSteps[0];
  const isLastStep = currentStepIndex === onboardingSteps.length - 1;
  const isStepAcknowledged = acknowledgedSteps.includes(currentStepIndex);
  const progress = Math.round(((currentStepIndex + 1) / onboardingSteps.length) * 100);

  const openOnboarding = () => {
    setCurrentStepIndex(0);
    setAcknowledgedSteps([]);
    setIsOpen(true);
  };

  const closeAndRemember = () => {
    storeCompletion();
    setIsOpen(false);
    setCurrentStepIndex(0);
    setAcknowledgedSteps([]);
  };

  const acknowledgeCurrentStep = () => {
    setAcknowledgedSteps((steps) =>
      steps.includes(currentStepIndex) ? steps : [...steps, currentStepIndex],
    );
  };

  const goToNextStep = () => {
    acknowledgeCurrentStep();

    if (isLastStep) {
      closeAndRemember();
      return;
    }

    setCurrentStepIndex((step) => Math.min(onboardingSteps.length - 1, step + 1));
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    const handleOpen = () => {
      setCurrentStepIndex(0);
      setAcknowledgedSteps([]);
      setIsOpen(true);
    };

    window.addEventListener(OPEN_ONBOARDING_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (!isProtectedPath(pathname)) return;
    if (getStoredCompletion()) return;

    const timeoutId = window.setTimeout(() => {
      setIsOpen(true);
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpenRef.current) return;

      if (event.key === "Escape") {
        event.preventDefault();
        storeCompletion();
        setIsOpen(false);
        setCurrentStepIndex(0);
        setAcknowledgedSteps([]);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentStepIndex((step) => Math.max(0, step - 1));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setAcknowledgedSteps((steps) =>
          steps.includes(currentStepIndexRef.current)
            ? steps
            : [...steps, currentStepIndexRef.current],
        );

        setCurrentStepIndex((step) => {
          if (step >= onboardingSteps.length - 1) {
            storeCompletion();
            window.setTimeout(() => {
              setIsOpen(false);
              setCurrentStepIndex(0);
              setAcknowledgedSteps([]);
            }, 0);
            return step;
          }

          return step + 1;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isMounted || !isOpen) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duepilot-onboarding-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflowY: "auto",
        padding: "20px",
        background:
          "radial-gradient(circle at 20% 0%, rgba(37, 99, 235, 0.24), transparent 34%), rgba(2, 6, 23, 0.94)",
        backdropFilter: "blur(6px)",
      }}
    >
      <section
        onClick={(event) => event.stopPropagation()}
        className="relative flex w-full max-w-[760px] flex-col overflow-hidden rounded-[1.75rem] border border-blue-200/15 text-white shadow-[0_30px_90px_rgba(0,0,0,0.7)] ring-1 ring-cyan-200/10"
        style={{
          maxHeight: "calc(100dvh - 40px)",
          backgroundColor: "#071126",
          backgroundImage:
            "radial-gradient(circle at 14% 0%, rgba(37, 99, 235, 0.24), transparent 35%), radial-gradient(circle at 100% 4%, rgba(0, 212, 255, 0.10), transparent 32%)",
        }}
      >
        <header className="shrink-0 border-b border-white/10 bg-slate-950/55 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-300/25 bg-blue-500/15 shadow-[0_0_28px_rgba(59,130,246,0.25)]">
                <span className="absolute inset-2 rounded-xl bg-gradient-to-br from-cyan-300/90 to-blue-600/90 opacity-90" />
                <span className="relative h-3 w-3 rounded-full bg-white shadow-[0_0_18px_rgba(147,197,253,0.9)]" />
              </span>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-100/70">
                  Tutoriel DuePilot
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Étape {currentStepIndex + 1} sur {onboardingSteps.length}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeAndRemember}
              className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-300/35 hover:bg-blue-400/10 hover:text-white"
            >
              Passer
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-950 ring-1 ring-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs font-bold text-blue-100/75">
              {progress}%
            </span>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2" aria-label="Progression du tutoriel">
            {onboardingSteps.map((step, index) => {
              const isCurrent = index === currentStepIndex;
              const isPastStep = index < currentStepIndex || acknowledgedSteps.includes(index);

              return (
                <button
                  key={step.eyebrow}
                  type="button"
                  onClick={() => setCurrentStepIndex(index)}
                  title={`${index + 1}. ${step.eyebrow}`}
                  className={`h-2.5 rounded-full transition-all ${
                    isCurrent
                      ? "w-8 bg-blue-300 shadow-[0_0_18px_rgba(96,165,250,0.5)]"
                      : isPastStep
                        ? "w-2.5 bg-emerald-300/75 hover:bg-emerald-200"
                        : "w-2.5 bg-white/16 hover:bg-blue-300/45"
                  }`}
                />
              );
            })}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100">
            {currentStep.eyebrow}
          </div>

          <h2
            id="duepilot-onboarding-title"
            className="mt-4 text-2xl font-bold leading-tight tracking-tight text-white sm:text-[1.9rem]"
          >
            {currentStep.title}
          </h2>

          <p className="mt-3 text-sm leading-6 text-blue-100/75">
            Vous pourrez relancer ce tutoriel à tout moment depuis{" "}
            <strong className="text-blue-50">Mon compte → Manuel utilisateur</strong>.
          </p>

          <p className="mt-5 text-base leading-7 text-slate-300">
            {currentStep.description}
          </p>

          <div className="mt-5 grid gap-2.5">
            {currentStep.details.map((detail) => (
              <div
                key={detail}
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 text-sm leading-6 text-slate-300"
              >
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-xs font-bold text-emerald-200">
                  ✓
                </span>
                <span>{detail}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-4 shadow-inner shadow-white/5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-100/70">
                Exemple concret
              </p>
              <p className="mt-2.5 text-sm leading-6 text-blue-50/90">
                {currentStep.example}
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/70">
                Après cette étape
              </p>
              <p className="mt-2.5 text-sm leading-6 text-emerald-50/90">
                {currentStep.nextAction}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={acknowledgeCurrentStep}
            className={`mt-5 w-full rounded-2xl px-5 py-3 text-sm font-bold transition ${
              isStepAcknowledged
                ? "border border-emerald-300/25 bg-emerald-400/15 text-emerald-100"
                : "border border-white/10 bg-white/[0.055] text-blue-50 hover:border-blue-300/35 hover:bg-blue-400/15"
            }`}
          >
            {isStepAcknowledged ? "Étape comprise ✓" : "J'ai compris cette étape"}
          </button>
        </main>

        <footer className="shrink-0 border-t border-white/10 bg-slate-950/70 px-5 py-4">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setCurrentStepIndex((step) => Math.max(0, step - 1))}
              disabled={currentStepIndex === 0}
              className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-blue-300/30 hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Précédent
            </button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={closeAndRemember}
                className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-blue-300/30 hover:bg-blue-400/10 hover:text-white"
              >
                Passer le tutoriel
              </button>

              <button
                type="button"
                onClick={goToNextStep}
                className="inline-flex justify-center rounded-2xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-400"
              >
                {isLastStep ? "Terminer" : "Suivant"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-center text-xs leading-5 text-blue-100/55">
            Vous pourrez le relancer plus tard depuis Mon compte, en bas de page.
          </p>
        </footer>
      </section>
    </div>
  );

  return createPortal(overlay, document.body);
}
