"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  isValidUsefulLinkUrl,
  normalizeUsefulLinkLabel,
  normalizeUsefulLinkUrl,
} from "@/lib/deadline-treatment";
import type { OrganizationMemberRole } from "@/lib/organizations";
import {
  DEADLINE_TEMPLATE_VISIBILITY_DESCRIPTIONS,
  DEADLINE_TEMPLATE_VISIBILITY_LABELS,
  buildDeadlineTemplatePayload,
  normalizeDeadlineTemplateName,
  type DeadlineTemplateVisibility,
} from "@/lib/deadline-template-library";
import { createClient } from "@/lib/supabase/client";

type SaveDeadlineAsTemplateButtonProps = {
  userId: string;
  organizationId?: string | null;
  organizationRole?: OrganizationMemberRole | null;
  deadline: {
    title: string;
    category: string | null;
    category_key?: string | null;
    custom_category_label?: string | null;
    notification_days?: number[] | null;
    recurrence_rule?: string | null;
    importance_level?: string | null;
    treatment_note?: string | null;
    useful_link_url?: string | null;
    useful_link_label?: string | null;
  };
  checklistItems: Array<{ title: string }>;
};

function canManageOrganizationTemplates(role: OrganizationMemberRole | null | undefined) {
  return role === "owner" || role === "admin";
}

function getVisibilityClassName(visibility: DeadlineTemplateVisibility) {
  if (visibility === "organization") {
    return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  }

  return "border-violet-400/25 bg-violet-400/10 text-violet-100";
}

export default function SaveDeadlineAsTemplateButton({
  userId,
  organizationId,
  organizationRole,
  deadline,
  checklistItems,
}: SaveDeadlineAsTemplateButtonProps) {
  const supabase = createClient();
  const canCreateOrganizationTemplate = canManageOrganizationTemplates(organizationRole) && Boolean(organizationId);
  const [isOpen, setIsOpen] = useState(false);
  const [templateName, setTemplateName] = useState(deadline.title);
  const [visibility, setVisibility] = useState<DeadlineTemplateVisibility>(
    canCreateOrganizationTemplate ? "organization" : "personal"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    setErrorMessage("");
    setSuccessMessage("");

    const safeName = normalizeDeadlineTemplateName(templateName);
    const usefulLinkUrl = normalizeUsefulLinkUrl(deadline.useful_link_url);
    const usefulLinkLabel = normalizeUsefulLinkLabel(deadline.useful_link_label);

    if (!safeName) {
      setErrorMessage("Renseignez un nom pour le modèle.");
      return;
    }

    if (usefulLinkUrl && !isValidUsefulLinkUrl(usefulLinkUrl)) {
      setErrorMessage("Le lien utile de cette échéance est invalide et ne peut pas être sauvegardé dans le modèle.");
      return;
    }

    setIsSaving(true);

    const payload = buildDeadlineTemplatePayload({
      userId,
      organizationId,
      canCreateOrganizationTemplate,
      visibility,
      name: safeName,
      title: deadline.title,
      description: `Modèle créé depuis l’échéance « ${deadline.title} ».`,
      categoryKey: deadline.category_key,
      customCategoryLabel: deadline.custom_category_label,
      notificationDays: deadline.notification_days,
      recurrenceRule: deadline.recurrence_rule,
      importanceLevel: deadline.importance_level,
      treatmentNote: deadline.treatment_note,
      usefulLinkUrl,
      usefulLinkLabel,
      checklistItems,
    });

    const { error } = await supabase.from("deadline_templates").insert(payload);

    if (error) {
      console.error(error);
      setErrorMessage("Impossible d’enregistrer ce modèle pour le moment.");
      setIsSaving(false);
      return;
    }

    setSuccessMessage("Modèle enregistré dans votre bibliothèque.");
    setIsSaving(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex w-full justify-center rounded-xl border border-blue-400/25 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white sm:w-auto"
      >
        Enregistrer comme modèle
      </button>

      {isOpen ? (
        <div className="fixed inset-x-4 top-20 z-[90] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-3xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-96">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-white">Ajouter à la bibliothèque</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                DuePilot copie les réglages réutilisables, sans document, date, statut ni historique.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          {successMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm leading-6 text-emerald-100">
              {successMessage}{" "}
              <Link href="/deadlines/library" className="font-bold underline underline-offset-4">
                Voir la bibliothèque
              </Link>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm leading-6 text-red-200">
              {errorMessage}
            </div>
          ) : null}

          {!successMessage ? (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="saveTemplateName" className="mb-2 block text-sm font-semibold text-slate-100">
                  Nom du modèle
                </label>
                <input
                  id="saveTemplateName"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  disabled={isSaving}
                  maxLength={120}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(["personal", "organization"] as DeadlineTemplateVisibility[]).map((visibilityOption) => {
                  const isDisabled = isSaving || (visibilityOption === "organization" && !canCreateOrganizationTemplate);
                  const isSelected = visibility === visibilityOption;

                  return (
                    <button
                      key={visibilityOption}
                      type="button"
                      onClick={() => setVisibility(visibilityOption)}
                      disabled={isDisabled}
                      className={`rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? getVisibilityClassName(visibilityOption)
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="block text-sm font-bold text-white">
                        {DEADLINE_TEMPLATE_VISIBILITY_LABELS[visibilityOption]}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">
                        {DEADLINE_TEMPLATE_VISIBILITY_DESCRIPTIONS[visibilityOption]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex w-full justify-center rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-blue-500/50"
              >
                {isSaving ? "Enregistrement..." : "Enregistrer le modèle"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
