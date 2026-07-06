"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import CollapsibleFormSection from "@/components/CollapsibleFormSection";
import DateField from "@/components/DateField";
import DeadlineDocumentField from "@/components/DeadlineDocumentField";
import DeadlineCategoryField from "@/components/DeadlineCategoryField";
import DeadlineTemplatePicker from "@/components/DeadlineTemplatePicker";
import DeadlineImportanceSelector from "@/components/DeadlineImportanceSelector";
import DeadlineTreatmentOptions from "@/components/DeadlineTreatmentOptions";
import RecurrenceSelector from "@/components/RecurrenceSelector";
import NotificationDaysSelector, {
  DEFAULT_NOTIFICATION_DAYS,
  normalizeNotificationDays,
} from "@/components/NotificationDaysSelector";
import { createActivityLogs } from "@/lib/activity-logs";
import {
  isValidUsefulLinkUrl,
  normalizeChecklistItems,
  normalizeTreatmentNote,
  normalizeUsefulLinkLabel,
  normalizeUsefulLinkUrl,
  type EditableChecklistItem,
} from "@/lib/deadline-treatment";
import { canManageTeamDeadlines, type DeadlineVisibility } from "@/lib/deadline-access";
import { saveDeadlineDocuments } from "@/lib/deadline-document-actions";
import type { DeadlineTemplate } from "@/lib/deadline-templates";
import { RECURRENCE_SHORT_LABELS, type RecurrenceRule } from "@/lib/recurrence";
import {
  DEFAULT_DEADLINE_CATEGORY_KEY,
  buildStoredDeadlineCategory,
  getDeadlineCategoryDisplay,
  inferDeadlineCategoryKey,
  normalizeCustomCategoryLabel,
  normalizeDeadlineCategoryKey,
  type DeadlineCategoryKey,
} from "@/lib/deadline-categories";
import { createClient } from "@/lib/supabase/client";
import {
  DEADLINE_IMPORTANCE_LABELS,
  type DeadlineImportanceLevel,
} from "@/lib/deadline-importance";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function parseLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    const fallbackDate = new Date(date);
    fallbackDate.setHours(0, 0, 0, 0);
    return fallbackDate;
  }

  return new Date(year, month - 1, day);
}

function formatDateForPreview(date: string) {
  if (!date) return "Date non définie";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parseLocalDate(date));
}

function getDaysUntilDueDate(date: string) {
  if (!date) return null;

  const today = new Date();
  const dueDate = parseLocalDate(date);

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return Math.ceil((dueDate.getTime() - today.getTime()) / DAY_IN_MS);
}

function getDateInsight(date: string) {
  const daysUntilDueDate = getDaysUntilDueDate(date);

  if (daysUntilDueDate === null) {
    return {
      label: "À définir",
      description: "Ajoutez une date pour calculer automatiquement le niveau d’urgence.",
      className: "border-white/10 bg-white/[0.03] text-slate-300",
    };
  }

  if (daysUntilDueDate < 0) {
    const daysLate = Math.abs(daysUntilDueDate);

    return {
      label: `En retard de ${daysLate} jour${daysLate > 1 ? "s" : ""}`,
      description: "Cette échéance sera classée comme critique dès son ajout.",
      className: "border-red-400/25 bg-red-400/10 text-red-100",
    };
  }

  if (daysUntilDueDate === 0) {
    return {
      label: "Jour J",
      description: "Cette échéance doit être traitée aujourd’hui.",
      className: "border-orange-400/25 bg-orange-400/10 text-orange-100",
    };
  }

  if (daysUntilDueDate <= 7) {
    return {
      label: `J-${daysUntilDueDate}`,
      description: "Échéance très proche : prévoyez une action rapide.",
      className: "border-orange-400/25 bg-orange-400/10 text-orange-100",
    };
  }

  if (daysUntilDueDate <= 30) {
    return {
      label: `J-${daysUntilDueDate}`,
      description: "Échéance à anticiper dans le mois à venir.",
      className: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
    };
  }

  return {
    label: `J-${daysUntilDueDate}`,
    description: "Échéance sous contrôle, visible suffisamment en avance.",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  };
}

function getReminderPreview(days: number[]) {
  const normalizedDays = normalizeNotificationDays(days);

  if (normalizedDays.length === 0) {
    return "Aucun rappel sélectionné";
  }

  return normalizedDays
    .map((day) => {
      if (day === 0) return "Jour J";
      return `J-${day}`;
    })
    .join(" · ");
}

export default function NewDeadlinePage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [categoryKey, setCategoryKey] = useState<DeadlineCategoryKey>(DEFAULT_DEADLINE_CATEGORY_KEY);
  const [customCategoryLabel, setCustomCategoryLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notificationDays, setNotificationDays] = useState<number[]>(
    DEFAULT_NOTIFICATION_DAYS
  );
  const [visibility, setVisibility] = useState<DeadlineVisibility>("personal");
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>("none");
  const [importanceLevel, setImportanceLevel] =
    useState<DeadlineImportanceLevel>("normal");
  const [canCreateTeamDeadline, setCanCreateTeamDeadline] = useState(false);
  const [selectedDocumentFiles, setSelectedDocumentFiles] = useState<File[]>([]);
  const [enableDocument, setEnableDocument] = useState(false);
  const [enableChecklist, setEnableChecklist] = useState(false);
  const [enableNote, setEnableNote] = useState(false);
  const [enableUsefulLink, setEnableUsefulLink] = useState(false);
  const [checklistItems, setChecklistItems] = useState<EditableChecklistItem[]>([
    { title: "" },
  ]);
  const [treatmentNote, setTreatmentNote] = useState("");
  const [usefulLinkLabel, setUsefulLinkLabel] = useState("");
  const [usefulLinkUrl, setUsefulLinkUrl] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [appliedTemplateName, setAppliedTemplateName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedNotificationDays = useMemo(
    () => normalizeNotificationDays(notificationDays),
    [notificationDays]
  );
  const dateInsight = useMemo(() => getDateInsight(dueDate), [dueDate]);
  const deadlinePreviewTitle = title.trim() || "Nouvelle échéance";
  const normalizedCustomCategoryLabel = useMemo(
    () => normalizeCustomCategoryLabel(customCategoryLabel),
    [customCategoryLabel]
  );
  const deadlineCategoryLabel = useMemo(
    () =>
      getDeadlineCategoryDisplay({
        categoryKey,
        customCategoryLabel: normalizedCustomCategoryLabel,
      }),
    [categoryKey, normalizedCustomCategoryLabel]
  );
  const deadlinePreviewCategory = deadlineCategoryLabel;


  useEffect(() => {
    let isMounted = true;

    async function loadMembership() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isMounted) return;

      const canCreateTeam = canManageTeamDeadlines(data?.role);
      setCanCreateTeamDeadline(canCreateTeam);
      if (!canCreateTeam) setVisibility("personal");
    }

    loadMembership();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleTemplateSelect = (template: DeadlineTemplate) => {
    if (isLoading) return;

    setTitle(template.title);
    setCategoryKey(inferDeadlineCategoryKey(template.category, template.title));
    setCustomCategoryLabel("");
    setNotificationDays(template.recommendedNotificationDays);
    setSelectedTemplateId(template.id);
    setAppliedTemplateName(template.title);
    setErrorMessage("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isLoading) return;

    setErrorMessage("");

    const safeCategoryKey = normalizeDeadlineCategoryKey(categoryKey);
    const storedCategory = buildStoredDeadlineCategory({
      categoryKey: safeCategoryKey,
      customCategoryLabel: normalizedCustomCategoryLabel,
    });

    if (!title.trim() || !safeCategoryKey || !dueDate) {
      setErrorMessage("Complétez le nom, la catégorie et la date d’échéance.");
      return;
    }

    const selectedNotificationDays = normalizeNotificationDays(notificationDays);

    if (selectedNotificationDays.length === 0) {
      setErrorMessage("Sélectionnez au moins un rappel automatique.");
      return;
    }

    const normalizedTreatmentNote = enableNote
      ? normalizeTreatmentNote(treatmentNote)
      : "";
    const normalizedUsefulLinkUrl = enableUsefulLink
      ? normalizeUsefulLinkUrl(usefulLinkUrl)
      : "";
    const normalizedUsefulLinkLabel = enableUsefulLink
      ? normalizeUsefulLinkLabel(usefulLinkLabel)
      : "";
    const normalizedChecklistItems = enableChecklist
      ? normalizeChecklistItems(checklistItems)
      : [];

    if (enableUsefulLink && !normalizedUsefulLinkUrl) {
      setErrorMessage("Ajoutez une URL pour le lien utile ou désactivez cette option.");
      return;
    }

    if (normalizedUsefulLinkUrl && !isValidUsefulLinkUrl(normalizedUsefulLinkUrl)) {
      setErrorMessage("Le lien utile doit commencer par http:// ou https://.");
      return;
    }

    setIsLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      router.refresh();
      return;
    }

    const { data: activeMembership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(membershipError);
    }

    const canCreateTeam = canManageTeamDeadlines(activeMembership?.role);
    const safeVisibility: DeadlineVisibility =
      visibility === "team" && canCreateTeam ? "team" : "personal";

    const { data: createdDeadline, error } = await supabase
      .from("deadlines")
      .insert({
        title: title.trim(),
        category: storedCategory,
        category_key: safeCategoryKey,
        custom_category_label: normalizedCustomCategoryLabel || null,
        due_date: dueDate,
        user_id: user.id,
        organization_id: activeMembership?.organization_id ?? null,
        visibility: safeVisibility,
        workflow_status: "open",
        notification_days: selectedNotificationDays,
        recurrence_rule: recurrenceRule,
        importance_level: importanceLevel,
        treatment_note: normalizedTreatmentNote || null,
        useful_link_url: normalizedUsefulLinkUrl || null,
        useful_link_label: normalizedUsefulLinkLabel || null,
      })
      .select("id")
      .single();

    if (error || !createdDeadline?.id) {
      console.error(error);
      setErrorMessage(
        "Impossible de créer cette échéance pour le moment. Vérifiez les informations puis réessayez."
      );
      setIsLoading(false);
      return;
    }

    if (normalizedChecklistItems.length > 0) {
      const { error: checklistError } = await supabase
        .from("deadline_checklist_items")
        .insert(
          normalizedChecklistItems.map((item, index) => ({
            deadline_id: Number(createdDeadline.id),
            title: item.title,
            position: index,
            created_by: user.id,
          }))
        );

      if (checklistError) {
        console.error(checklistError);
        await supabase
          .from("deadlines")
          .delete()
          .eq("id", createdDeadline.id)
          .eq("user_id", user.id);

        setErrorMessage("Impossible d’ajouter la checklist de traitement pour le moment.");
        setIsLoading(false);
        return;
      }
    }

    if (enableDocument && selectedDocumentFiles.length > 0) {
      const documentResult = await saveDeadlineDocuments({
        supabase,
        userId: user.id,
        deadlineId: Number(createdDeadline.id),
        files: selectedDocumentFiles,
      });

      if (documentResult.errorMessage) {
        await supabase
          .from("deadlines")
          .delete()
          .eq("id", createdDeadline.id)
          .eq("user_id", user.id);

        setErrorMessage(documentResult.errorMessage);
        setIsLoading(false);
        return;
      }
    }

    await createActivityLogs([
      {
        supabase,
        userId: user.id,
        deadlineId: Number(createdDeadline.id),
        action: "deadline.created",
        title: "Échéance créée",
        description: `${title.trim()} a été ajoutée au suivi DuePilot.`,
        metadata: {
          title: title.trim(),
          category: storedCategory,
        category_key: safeCategoryKey,
        custom_category_label: normalizedCustomCategoryLabel || null,
          due_date: dueDate,
          notification_days: selectedNotificationDays,
          recurrence_rule: recurrenceRule,
          importance_level: importanceLevel,
          treatment_note: Boolean(normalizedTreatmentNote),
          useful_link_url: Boolean(normalizedUsefulLinkUrl),
          checklist_items_count: normalizedChecklistItems.length,
          template: appliedTemplateName || null,
          visibility: safeVisibility,
        },
      },
      ...(enableDocument && selectedDocumentFiles.length > 0
        ? [
            {
              supabase,
              userId: user.id,
              deadlineId: Number(createdDeadline.id),
              action: "document.added" as const,
              title: selectedDocumentFiles.length > 1 ? "Documents ajoutés" : "Document ajouté",
              description:
                selectedDocumentFiles.length > 1
                  ? `${selectedDocumentFiles.length} documents ont été associés à l’échéance.`
                  : `${selectedDocumentFiles[0].name} a été associé à l’échéance.`,
              metadata: {
                files_count: selectedDocumentFiles.length,
                file_names: selectedDocumentFiles.map((file) => file.name),
                file_size: selectedDocumentFiles.reduce((total, file) => total + file.size, 0),
              },
            },
          ]
        : []),
    ]);

    router.push("/deadlines");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-white sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/deadlines"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        >
          <span aria-hidden="true">←</span>
          Retour aux échéances
        </Link>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.035] to-blue-500/[0.06] p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
                Nouvelle surveillance
              </div>

              <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Ajoutez une échéance à surveiller
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Centralisez une obligation importante, classez-la proprement et
                choisissez les rappels que DuePilot devra déclencher avant la
                date critique.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 lg:w-80">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Résumé en direct
              </p>
              <p className="mt-3 line-clamp-2 text-lg font-bold text-white">
                {deadlinePreviewTitle}
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-400">
                <p>{deadlinePreviewCategory}</p>
                <p>{formatDateForPreview(dueDate)}</p>
                <p>{getReminderPreview(normalizedNotificationDays)}</p>
                <p>Récurrence : {RECURRENCE_SHORT_LABELS[recurrenceRule]}</p>
                <p>Importance : {DEADLINE_IMPORTANCE_LABELS[importanceLevel]}</p>
                <p>
                  {appliedTemplateName
                    ? `Modèle : ${appliedTemplateName}`
                    : "Aucun modèle appliqué"}
                </p>
                <p>{visibility === "team" ? "Portée : équipe" : "Portée : personnelle"}</p>
                <p>
                  {enableDocument
                    ? selectedDocumentFiles.length > 0
                      ? `${selectedDocumentFiles.length} document${selectedDocumentFiles.length > 1 ? "s" : ""} sélectionné${selectedDocumentFiles.length > 1 ? "s" : ""}`
                      : "Document activé sans fichier"
                    : "Document non activé"}
                </p>
                <p>
                  Options : {[
                    enableChecklist ? "checklist" : null,
                    enableNote ? "note" : null,
                    enableUsefulLink ? "lien" : null,
                  ].filter(Boolean).join(" · ") || "aucune"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
              <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Informations clés
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Donnez un nom clair, choisissez une catégorie et fixez la
                    date à surveiller.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                  Étape 1/3
                </span>
              </div>

              <div className="mt-6 grid gap-5">
                <div>
                  <label
                    htmlFor="title"
                    className="mb-2 block text-sm font-semibold text-slate-100"
                  >
                    Nom de l’échéance <span className="text-blue-200">*</span>
                  </label>

                  <input
                    id="title"
                    type="text"
                    placeholder="Ex : Assurance RC Pro"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isLoading}
                    autoComplete="off"
                    maxLength={120}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Utilisez un nom précis pour retrouver cette obligation
                    rapidement dans vos filtres.
                  </p>
                </div>

                <DeadlineCategoryField
                  categoryKey={categoryKey}
                  customCategoryLabel={customCategoryLabel}
                  onCategoryKeyChange={setCategoryKey}
                  onCustomCategoryLabelChange={setCustomCategoryLabel}
                  disabled={isLoading}
                  required
                />

                <DateField
                  id="dueDate"
                  label="Date d’échéance"
                  value={dueDate}
                  onChange={setDueDate}
                  disabled={isLoading}
                  required
                  hint="Utilisez le calendrier ou les raccourcis pour renseigner rapidement une date fiable."
                />
              </div>

              <div className="mt-6 grid gap-5 border-t border-white/10 pt-6">
                <DeadlineImportanceSelector
                  value={importanceLevel}
                  onChange={setImportanceLevel}
                  disabled={isLoading}
                  stepLabel="Criticité"
                />

                <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                  <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Portée de l’échéance</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">Choisissez si cette échéance reste personnelle ou si elle concerne toute l’équipe.</p>
                    </div>
                    <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">Base équipe</span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setVisibility("personal")}
                      disabled={isLoading}
                      className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        visibility === "personal"
                          ? "border-violet-400/40 bg-violet-400/10 text-violet-100"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="block text-sm font-bold text-white">Personnelle</span>
                      <span className="mt-2 block text-sm leading-6 text-slate-400">Visible uniquement par vous. Les autres membres ne la verront pas.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisibility("team")}
                      disabled={isLoading || !canCreateTeamDeadline}
                      className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        visibility === "team"
                          ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="block text-sm font-bold text-white">Équipe</span>
                      <span className="mt-2 block text-sm leading-6 text-slate-400">Visible par l’entreprise. Réservé aux propriétaires et administrateurs.</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <CollapsibleFormSection
              title="Options complémentaires"
              description="Ajoutez uniquement les blocs utiles : document, checklist, note ou lien."
              badge="Personnalisation"
            >
              <DeadlineTreatmentOptions
                enableDocument={enableDocument}
                onEnableDocumentChange={(value) => {
                  setEnableDocument(value);
                  if (!value) setSelectedDocumentFiles([]);
                }}
                enableChecklist={enableChecklist}
                onEnableChecklistChange={setEnableChecklist}
                enableNote={enableNote}
                onEnableNoteChange={setEnableNote}
                enableUsefulLink={enableUsefulLink}
                onEnableUsefulLinkChange={setEnableUsefulLink}
                checklistItems={checklistItems}
                onChecklistItemsChange={setChecklistItems}
                treatmentNote={treatmentNote}
                onTreatmentNoteChange={setTreatmentNote}
                usefulLinkLabel={usefulLinkLabel}
                onUsefulLinkLabelChange={setUsefulLinkLabel}
                usefulLinkUrl={usefulLinkUrl}
                onUsefulLinkUrlChange={setUsefulLinkUrl}
                disabled={isLoading}
              />
            </CollapsibleFormSection>

            {enableDocument ? (
              <DeadlineDocumentField
                selectedFiles={selectedDocumentFiles}
                onSelectedFilesChange={setSelectedDocumentFiles}
                disabled={isLoading}
                stepLabel="Documents"
              />
            ) : null}

            <CollapsibleFormSection
              title="Rappels et récurrence"
              description="Configurez les rappels automatiques et la prochaine date proposée au renouvellement."
              badge={`${normalizedNotificationDays.length} rappel${normalizedNotificationDays.length > 1 ? "s" : ""}`}
            >
              <div className="space-y-5">
                <RecurrenceSelector
                  value={recurrenceRule}
                  onChange={setRecurrenceRule}
                  disabled={isLoading}
                  dueDate={dueDate}
                  stepLabel="Récurrence"
                />

                <NotificationDaysSelector
                  selectedDays={notificationDays}
                  onChange={setNotificationDays}
                  disabled={isLoading}
                  stepLabel="Rappels"
                />
              </div>
            </CollapsibleFormSection>

            <CollapsibleFormSection
              title="Modèles d’échéances"
              description="Utilisez un modèle métier si vous souhaitez préremplir rapidement une échéance."
              badge="Optionnel"
            >
              <DeadlineTemplatePicker
                selectedTemplateId={selectedTemplateId}
                onSelectTemplate={handleTemplateSelect}
                disabled={isLoading}
              />
            </CollapsibleFormSection>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200"
              >
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/deadlines"
                className="inline-flex justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
              >
                Annuler
              </Link>

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex justify-center rounded-2xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-blue-500/50"
              >
                {isLoading ? "Création en cours..." : "Créer l’échéance"}
              </button>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className={`rounded-3xl border p-5 ${dateInsight.className}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                Niveau d’urgence
              </p>
              <p className="mt-3 text-2xl font-bold">{dateInsight.label}</p>
              <p className="mt-2 text-sm leading-6 opacity-80">
                {dateInsight.description}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm font-semibold text-white">
                Bonnes pratiques
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                  Ajoutez les assurances, certifications et contrôles qui
                  peuvent bloquer l’activité.
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                  Utilisez des catégories cohérentes pour faciliter la recherche
                  et les filtres.
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                  Gardez au moins un rappel proche de la date pour éviter les
                  oublis de dernière minute.
                </li>
              </ul>
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}
