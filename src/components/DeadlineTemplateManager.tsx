"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import DeadlineCategoryField from "@/components/DeadlineCategoryField";
import DeadlineImportanceSelector from "@/components/DeadlineImportanceSelector";
import NotificationDaysSelector from "@/components/NotificationDaysSelector";
import RecurrenceSelector from "@/components/RecurrenceSelector";
import {
  DEADLINE_CATEGORY_OPTIONS,
  getDeadlineCategoryDisplay,
  normalizeCustomCategoryLabel,
  type DeadlineCategoryKey,
} from "@/lib/deadline-categories";
import {
  DEADLINE_IMPORTANCE_LABELS,
  type DeadlineImportanceLevel,
} from "@/lib/deadline-importance";
import {
  isValidUsefulLinkUrl,
  normalizeUsefulLinkLabel,
  normalizeUsefulLinkUrl,
} from "@/lib/deadline-treatment";
import { RECURRENCE_SHORT_LABELS, type RecurrenceRule } from "@/lib/recurrence";
import type { OrganizationMemberRole } from "@/lib/organizations";
import {
  DEADLINE_TEMPLATE_VISIBILITY_DESCRIPTIONS,
  DEADLINE_TEMPLATE_VISIBILITY_LABELS,
  buildDeadlineTemplatePayload,
  getDeadlineTemplateReminderSummary,
  normalizeDeadlineTemplateName,
  normalizeDeadlineTemplateRows,
  normalizeDeadlineTemplateTitle,
  type DeadlineTemplateLibraryItem,
  type DeadlineTemplateLibraryRow,
  type DeadlineTemplateVisibility,
} from "@/lib/deadline-template-library";
import { createClient } from "@/lib/supabase/client";

type DeadlineTemplateManagerProps = {
  initialTemplates: DeadlineTemplateLibraryItem[];
  userId: string;
  organizationId?: string | null;
  organizationRole?: OrganizationMemberRole | null;
};

type CategoryFilter = "all" | DeadlineCategoryKey;
type ImportanceFilter = "all" | DeadlineImportanceLevel;
type RecurrenceFilter = "all" | RecurrenceRule;
type VisibilityFilter = "all" | DeadlineTemplateVisibility;

type TemplateFormState = {
  id: number | null;
  name: string;
  title: string;
  description: string;
  categoryKey: DeadlineCategoryKey;
  customCategoryLabel: string;
  notificationDays: number[];
  recurrenceRule: RecurrenceRule;
  importanceLevel: DeadlineImportanceLevel;
  visibility: DeadlineTemplateVisibility;
  treatmentNote: string;
  usefulLinkLabel: string;
  usefulLinkUrl: string;
  checklistText: string;
};

const INITIAL_FORM_STATE: TemplateFormState = {
  id: null,
  name: "",
  title: "",
  description: "",
  categoryKey: "administrative_document",
  customCategoryLabel: "",
  notificationDays: [30, 7, 1],
  recurrenceRule: "none",
  importanceLevel: "normal",
  visibility: "personal",
  treatmentNote: "",
  usefulLinkLabel: "",
  usefulLinkUrl: "",
  checklistText: "",
};

const IMPORTANCE_FILTERS: { value: ImportanceFilter; label: string }[] = [
  { value: "all", label: "Toutes criticités" },
  { value: "normal", label: DEADLINE_IMPORTANCE_LABELS.normal },
  { value: "high", label: DEADLINE_IMPORTANCE_LABELS.high },
  { value: "critical", label: DEADLINE_IMPORTANCE_LABELS.critical },
];

const RECURRENCE_FILTERS: { value: RecurrenceFilter; label: string }[] = [
  { value: "all", label: "Toutes récurrences" },
  { value: "none", label: RECURRENCE_SHORT_LABELS.none },
  { value: "monthly", label: RECURRENCE_SHORT_LABELS.monthly },
  { value: "quarterly", label: RECURRENCE_SHORT_LABELS.quarterly },
  { value: "semiannual", label: RECURRENCE_SHORT_LABELS.semiannual },
  { value: "yearly", label: RECURRENCE_SHORT_LABELS.yearly },
];

const VISIBILITY_FILTERS: { value: VisibilityFilter; label: string }[] = [
  { value: "all", label: "Tous les modèles" },
  { value: "personal", label: "Personnels" },
  { value: "organization", label: "Équipe" },
];

function canManageOrganizationTemplates(role: OrganizationMemberRole | null | undefined) {
  return role === "owner" || role === "admin";
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function checklistTextToItems(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 40)
    .map((title) => ({ title }));
}

function templateToFormState(template: DeadlineTemplateLibraryItem): TemplateFormState {
  return {
    id: template.id,
    name: template.name,
    title: template.title,
    description: template.description ?? "",
    categoryKey: template.category_key,
    customCategoryLabel: template.custom_category_label ?? "",
    notificationDays: template.notification_days,
    recurrenceRule: template.recurrence_rule,
    importanceLevel: template.importance_level,
    visibility: template.visibility,
    treatmentNote: template.treatment_note ?? "",
    usefulLinkLabel: template.useful_link_label ?? "",
    usefulLinkUrl: template.useful_link_url ?? "",
    checklistText: template.checklist_items.map((item) => item.title).join("\n"),
  };
}

function getVisibilityClassName(visibility: DeadlineTemplateVisibility) {
  if (visibility === "organization") {
    return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  }

  return "border-violet-400/25 bg-violet-400/10 text-violet-100";
}

export default function DeadlineTemplateManager({
  initialTemplates,
  userId,
  organizationId,
  organizationRole,
}: DeadlineTemplateManagerProps) {
  const supabase = createClient();
  const canCreateOrganizationTemplate = canManageOrganizationTemplates(organizationRole) && Boolean(organizationId);
  const [templates, setTemplates] = useState(initialTemplates);
  const [formState, setFormState] = useState<TemplateFormState>(INITIAL_FORM_STATE);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>("all");
  const [recurrenceFilter, setRecurrenceFilter] = useState<RecurrenceFilter>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyTemplateId, setBusyTemplateId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const personalCount = templates.filter((template) => template.visibility === "personal").length;
  const organizationCount = templates.filter((template) => template.visibility === "organization").length;
  const checklistTemplateCount = templates.filter((template) => template.checklist_items.length > 0).length;

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchQuery);

    return templates.filter((template) => {
      if (categoryFilter !== "all" && template.category_key !== categoryFilter) return false;
      if (importanceFilter !== "all" && template.importance_level !== importanceFilter) return false;
      if (recurrenceFilter !== "all" && template.recurrence_rule !== recurrenceFilter) return false;
      if (visibilityFilter !== "all" && template.visibility !== visibilityFilter) return false;

      if (!normalizedSearch) return true;

      const searchableContent = normalizeSearch(
        [
          template.name,
          template.title,
          template.description,
          template.category,
          template.custom_category_label,
          DEADLINE_IMPORTANCE_LABELS[template.importance_level],
          RECURRENCE_SHORT_LABELS[template.recurrence_rule],
          DEADLINE_TEMPLATE_VISIBILITY_LABELS[template.visibility],
          ...template.checklist_items.map((item) => item.title),
        ]
          .filter(Boolean)
          .join(" ")
      );

      return searchableContent.includes(normalizedSearch);
    });
  }, [categoryFilter, importanceFilter, recurrenceFilter, searchQuery, templates, visibilityFilter]);

  const resetForm = () => {
    setFormState(INITIAL_FORM_STATE);
    setIsFormOpen(false);
    setErrorMessage("");
  };

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setImportanceFilter("all");
    setRecurrenceFilter("all");
    setVisibilityFilter("all");
  };

  const canEditTemplate = (template: DeadlineTemplateLibraryItem) => {
    if (template.visibility === "organization") return canCreateOrganizationTemplate;
    return template.created_by === userId;
  };

  const startCreateTemplate = () => {
    setFormState({
      ...INITIAL_FORM_STATE,
      visibility: canCreateOrganizationTemplate ? "organization" : "personal",
    });
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
  };

  const startEditTemplate = (template: DeadlineTemplateLibraryItem) => {
    setFormState(templateToFormState(template));
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) return;

    setErrorMessage("");
    setSuccessMessage("");

    const safeName = normalizeDeadlineTemplateName(formState.name);
    const safeTitle = normalizeDeadlineTemplateTitle(formState.title);
    const usefulLinkUrl = normalizeUsefulLinkUrl(formState.usefulLinkUrl);
    const usefulLinkLabel = normalizeUsefulLinkLabel(formState.usefulLinkLabel);

    if (!safeName || !safeTitle) {
      setErrorMessage("Renseignez au minimum le nom du modèle et le nom de l’échéance.");
      return;
    }

    if (usefulLinkUrl && !isValidUsefulLinkUrl(usefulLinkUrl)) {
      setErrorMessage("Le lien utile doit commencer par http:// ou https://.");
      return;
    }

    setIsSaving(true);

    const payload = buildDeadlineTemplatePayload({
      userId,
      organizationId,
      canCreateOrganizationTemplate,
      visibility: formState.visibility,
      name: safeName,
      title: safeTitle,
      description: formState.description,
      categoryKey: formState.categoryKey,
      customCategoryLabel: normalizeCustomCategoryLabel(formState.customCategoryLabel),
      notificationDays: formState.notificationDays,
      recurrenceRule: formState.recurrenceRule,
      importanceLevel: formState.importanceLevel,
      treatmentNote: formState.treatmentNote,
      usefulLinkUrl,
      usefulLinkLabel,
      checklistItems: checklistTextToItems(formState.checklistText),
    });

    if (formState.id) {
      const { data, error } = await supabase
        .from("deadline_templates")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", formState.id)
        .select(
          "id, organization_id, created_by, visibility, name, title, description, category, category_key, custom_category_label, notification_days, recurrence_rule, importance_level, treatment_note, useful_link_url, useful_link_label, checklist_items, created_at, updated_at"
        )
        .single();

      if (error || !data) {
        console.error(error);
        setErrorMessage("Impossible de modifier ce modèle pour le moment.");
        setIsSaving(false);
        return;
      }

      const normalizedTemplate = normalizeDeadlineTemplateRows([data as DeadlineTemplateLibraryRow])[0];
      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === normalizedTemplate.id ? normalizedTemplate : template
        )
      );
      setSuccessMessage("Modèle mis à jour.");
    } else {
      const { data, error } = await supabase
        .from("deadline_templates")
        .insert(payload)
        .select(
          "id, organization_id, created_by, visibility, name, title, description, category, category_key, custom_category_label, notification_days, recurrence_rule, importance_level, treatment_note, useful_link_url, useful_link_label, checklist_items, created_at, updated_at"
        )
        .single();

      if (error || !data) {
        console.error(error);
        setErrorMessage("Impossible de créer ce modèle pour le moment.");
        setIsSaving(false);
        return;
      }

      const normalizedTemplate = normalizeDeadlineTemplateRows([data as DeadlineTemplateLibraryRow])[0];
      setTemplates((currentTemplates) => [normalizedTemplate, ...currentTemplates]);
      setSuccessMessage("Modèle ajouté à la bibliothèque.");
    }

    setIsSaving(false);
    resetForm();
  };

  const handleDeleteTemplate = async (template: DeadlineTemplateLibraryItem) => {
    if (busyTemplateId || !canEditTemplate(template)) return;

    const confirmDelete = window.confirm(
      `Supprimer définitivement le modèle « ${template.name} » ?`
    );

    if (!confirmDelete) return;

    setBusyTemplateId(template.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.from("deadline_templates").delete().eq("id", template.id);

    if (error) {
      console.error(error);
      setErrorMessage("Impossible de supprimer ce modèle pour le moment.");
      setBusyTemplateId(null);
      return;
    }

    setTemplates((currentTemplates) =>
      currentTemplates.filter((currentTemplate) => currentTemplate.id !== template.id)
    );
    setSuccessMessage("Modèle supprimé.");
    setBusyTemplateId(null);
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5">
          <p className="text-sm font-medium text-blue-100/80">Modèles enregistrés</p>
          <p className="mt-3 text-4xl font-bold text-white">{templates.length}</p>
          <p className="mt-2 text-sm leading-6 text-blue-50/70">
            {personalCount} personnel{personalCount > 1 ? "s" : ""} · {organizationCount} équipe
          </p>
        </div>
        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
          <p className="text-sm font-medium text-cyan-100/80">Avec checklist</p>
          <p className="mt-3 text-4xl font-bold text-white">{checklistTemplateCount}</p>
          <p className="mt-2 text-sm leading-6 text-cyan-50/70">
            Étapes de traitement réutilisables.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm font-medium text-slate-300">Raccourci création</p>
          <p className="mt-3 text-4xl font-bold text-white">↗</p>
          <Link
            href="/deadlines/new"
            className="mt-2 inline-flex text-sm font-semibold text-blue-200 transition hover:text-white"
          >
            Créer une échéance avec un modèle
          </Link>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Bibliothèque</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Gérez les modèles que vous réutilisez souvent. Les documents, les dates,
              les statuts et l’historique ne sont jamais copiés dans un modèle.
            </p>
          </div>
          <button
            type="button"
            onClick={startCreateTemplate}
            className="inline-flex justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          >
            Créer un modèle
          </button>
        </div>

        {successMessage ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {isFormOpen ? (
          <form onSubmit={handleSubmit} className="mt-6 rounded-3xl border border-blue-400/20 bg-blue-400/[0.055] p-5 sm:p-6">
            <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-lg font-bold text-white">
                  {formState.id ? "Modifier le modèle" : "Nouveau modèle"}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Définissez les informations qui seront réutilisées lors des prochaines créations d’échéances.
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                disabled={isSaving}
                className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="templateName" className="mb-2 block text-sm font-semibold text-slate-100">
                  Nom du modèle <span className="text-blue-200">*</span>
                </label>
                <input
                  id="templateName"
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  disabled={isSaving}
                  maxLength={120}
                  placeholder="Ex : Renouvellement assurance annuelle"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="templateTitle" className="mb-2 block text-sm font-semibold text-slate-100">
                  Nom de l’échéance prérempli <span className="text-blue-200">*</span>
                </label>
                <input
                  id="templateTitle"
                  value={formState.title}
                  onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                  disabled={isSaving}
                  maxLength={120}
                  placeholder="Ex : Assurance RC Pro"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="templateDescription" className="mb-2 block text-sm font-semibold text-slate-100">
                  Description du modèle
                </label>
                <textarea
                  id="templateDescription"
                  value={formState.description}
                  onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                  disabled={isSaving}
                  rows={3}
                  maxLength={800}
                  placeholder="Expliquez quand utiliser ce modèle..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="lg:col-span-2">
                <DeadlineCategoryField
                  categoryKey={formState.categoryKey}
                  customCategoryLabel={formState.customCategoryLabel}
                  onCategoryKeyChange={(value) => setFormState((current) => ({ ...current, categoryKey: value }))}
                  onCustomCategoryLabelChange={(value) => setFormState((current) => ({ ...current, customCategoryLabel: value }))}
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="lg:col-span-2">
                <DeadlineImportanceSelector
                  value={formState.importanceLevel}
                  onChange={(value) => setFormState((current) => ({ ...current, importanceLevel: value }))}
                  disabled={isSaving}
                  stepLabel="Criticité du modèle"
                />
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 lg:col-span-2">
                <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Visibilité du modèle</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Les modèles d’équipe sont réservés aux propriétaires et administrateurs.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                    Bibliothèque
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {(["personal", "organization"] as DeadlineTemplateVisibility[]).map((visibility) => {
                    const isDisabled = isSaving || (visibility === "organization" && !canCreateOrganizationTemplate);
                    const isSelected = formState.visibility === visibility;

                    return (
                      <button
                        key={visibility}
                        type="button"
                        onClick={() => setFormState((current) => ({ ...current, visibility }))}
                        disabled={isDisabled}
                        className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          isSelected
                            ? getVisibilityClassName(visibility)
                            : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className="block text-sm font-bold text-white">
                          {DEADLINE_TEMPLATE_VISIBILITY_LABELS[visibility]}
                        </span>
                        <span className="mt-2 block text-sm leading-6 text-slate-400">
                          {DEADLINE_TEMPLATE_VISIBILITY_DESCRIPTIONS[visibility]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-2">
                <RecurrenceSelector
                  value={formState.recurrenceRule}
                  onChange={(value) => setFormState((current) => ({ ...current, recurrenceRule: value }))}
                  disabled={isSaving}
                  dueDate=""
                  stepLabel="Récurrence du modèle"
                />
              </div>

              <div className="lg:col-span-2">
                <NotificationDaysSelector
                  selectedDays={formState.notificationDays}
                  onChange={(value) => setFormState((current) => ({ ...current, notificationDays: value }))}
                  disabled={isSaving}
                  stepLabel="Rappels du modèle"
                />
              </div>

              <div>
                <label htmlFor="templateUsefulLinkLabel" className="mb-2 block text-sm font-semibold text-slate-100">
                  Libellé du lien utile
                </label>
                <input
                  id="templateUsefulLinkLabel"
                  value={formState.usefulLinkLabel}
                  onChange={(event) => setFormState((current) => ({ ...current, usefulLinkLabel: event.target.value }))}
                  disabled={isSaving}
                  maxLength={80}
                  placeholder="Ex : Espace assureur"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="templateUsefulLinkUrl" className="mb-2 block text-sm font-semibold text-slate-100">
                  URL du lien utile
                </label>
                <input
                  id="templateUsefulLinkUrl"
                  value={formState.usefulLinkUrl}
                  onChange={(event) => setFormState((current) => ({ ...current, usefulLinkUrl: event.target.value }))}
                  disabled={isSaving}
                  maxLength={300}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="templateTreatmentNote" className="mb-2 block text-sm font-semibold text-slate-100">
                  Note de traitement préremplie
                </label>
                <textarea
                  id="templateTreatmentNote"
                  value={formState.treatmentNote}
                  onChange={(event) => setFormState((current) => ({ ...current, treatmentNote: event.target.value }))}
                  disabled={isSaving}
                  rows={4}
                  maxLength={1200}
                  placeholder="Ex : Vérifier le contrat, demander l’attestation, déposer le justificatif..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="templateChecklist" className="mb-2 block text-sm font-semibold text-slate-100">
                  Checklist préremplie
                </label>
                <textarea
                  id="templateChecklist"
                  value={formState.checklistText}
                  onChange={(event) => setFormState((current) => ({ ...current, checklistText: event.target.value }))}
                  disabled={isSaving}
                  rows={5}
                  placeholder={"Une étape par ligne\nEx : Demander le devis\nEx : Vérifier la date de validité"}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Une ligne = une étape. Maximum 40 étapes conservées.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                disabled={isSaving}
                className="inline-flex justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex justify-center rounded-2xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-blue-500/50"
              >
                {isSaving ? "Enregistrement..." : formState.id ? "Enregistrer les modifications" : "Ajouter le modèle"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.85fr_0.85fr] xl:grid-cols-[1.3fr_0.85fr_0.85fr_0.85fr_0.85fr]">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Rechercher un modèle, une note, une checklist..."
            className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10"
          />

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
            className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
          >
            <option value="all">Toutes catégories</option>
            {DEADLINE_CATEGORY_OPTIONS.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>

          <select
            value={visibilityFilter}
            onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}
            className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
          >
            {VISIBILITY_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <select
            value={importanceFilter}
            onChange={(event) => setImportanceFilter(event.target.value as ImportanceFilter)}
            className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
          >
            {IMPORTANCE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <select
            value={recurrenceFilter}
            onChange={(event) => setRecurrenceFilter(event.target.value as RecurrenceFilter)}
            className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
          >
            {RECURRENCE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">
            {filteredTemplates.length} modèle{filteredTemplates.length > 1 ? "s" : ""} affiché{filteredTemplates.length > 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            Réinitialiser les filtres
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {filteredTemplates.map((template) => {
            const categoryLabel = getDeadlineCategoryDisplay({
              category: template.category,
              categoryKey: template.category_key,
              customCategoryLabel: template.custom_category_label,
            });
            const canEdit = canEditTemplate(template);

            return (
              <article
                key={template.id}
                className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-blue-300/30 hover:bg-blue-400/[0.07]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getVisibilityClassName(template.visibility)}`}>
                        {DEADLINE_TEMPLATE_VISIBILITY_LABELS[template.visibility]}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-300">
                        {categoryLabel}
                      </span>
                    </div>
                    <h3 className="mt-4 break-words text-xl font-bold text-white">
                      {template.name}
                    </h3>
                    <p className="mt-2 break-words text-sm font-semibold text-blue-100">
                      Échéance : {template.title}
                    </p>
                    {template.description ? (
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                        {template.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Rappels</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {getDeadlineTemplateReminderSummary(template.notification_days)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Récurrence</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {RECURRENCE_SHORT_LABELS[template.recurrence_rule]}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Importance</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {DEADLINE_IMPORTANCE_LABELS[template.importance_level]}
                    </p>
                  </div>
                </div>

                {template.checklist_items.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Checklist
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                      {template.checklist_items.slice(0, 4).map((item) => (
                        <li key={item.title} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                          <span className="break-words">{item.title}</span>
                        </li>
                      ))}
                    </ul>
                    {template.checklist_items.length > 4 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        + {template.checklist_items.length - 4} autre{template.checklist_items.length - 4 > 1 ? "s" : ""} étape{template.checklist_items.length - 4 > 1 ? "s" : ""}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href={`/deadlines/new?template=${template.id}`}
                    className="inline-flex justify-center rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
                  >
                    Utiliser
                  </Link>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => startEditTemplate(template)}
                      disabled={busyTemplateId === template.id}
                      className="inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Modifier
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(template)}
                      disabled={busyTemplateId === template.id}
                      className="inline-flex justify-center rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:border-red-300/40 hover:bg-red-400/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyTemplateId === template.id ? "Suppression..." : "Supprimer"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
            <p className="text-lg font-bold text-white">Aucun modèle trouvé.</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Créez un modèle depuis cette page ou enregistrez une échéance existante comme modèle.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
