"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import CollapsibleFormSection from "@/components/CollapsibleFormSection";
import DateField from "@/components/DateField";
import DeadlineDocumentField from "@/components/DeadlineDocumentField";
import DeadlineCategoryField from "@/components/DeadlineCategoryField";
import DeadlineImportanceSelector from "@/components/DeadlineImportanceSelector";
import DeadlineTreatmentOptions from "@/components/DeadlineTreatmentOptions";
import { createActivityLogs, type CreateActivityLogParams } from "@/lib/activity-logs";
import {
  isValidUsefulLinkUrl,
  normalizeChecklistItems,
  normalizeTreatmentNote,
  normalizeUsefulLinkLabel,
  normalizeUsefulLinkUrl,
  type DeadlineChecklistItem,
  type EditableChecklistItem,
} from "@/lib/deadline-treatment";
import NotificationDaysSelector, {
  DEFAULT_NOTIFICATION_DAYS,
  normalizeNotificationDays,
} from "@/components/NotificationDaysSelector";
import {
  deleteDeadlineDocument,
  saveDeadlineDocument,
} from "@/lib/deadline-document-actions";
import type { DeadlineDocument } from "@/lib/deadline-documents";
import { normalizeRecurrenceRule, RECURRENCE_SHORT_LABELS, type RecurrenceRule } from "@/lib/recurrence";
import {
  buildStoredDeadlineCategory,
  getDeadlineCategoryDisplay,
  getDeadlineMainCategoryKey,
  normalizeCustomCategoryLabel,
  normalizeDeadlineCategoryKey,
  type DeadlineCategoryKey,
} from "@/lib/deadline-categories";
import RecurrenceSelector from "@/components/RecurrenceSelector";
import { createClient } from "@/lib/supabase/client";
import {
  DEADLINE_IMPORTANCE_LABELS,
  normalizeDeadlineImportance,
  type DeadlineImportanceLevel,
} from "@/lib/deadline-importance";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

type Deadline = {
  id: number;
  title: string;
  category: string;
  category_key?: string | null;
  custom_category_label?: string | null;
  due_date: string;
  notification_days?: number[] | null;
  recurrence_rule?: string | null;
  importance_level?: string | null;
  treatment_note?: string | null;
  useful_link_url?: string | null;
  useful_link_label?: string | null;
  created_at?: string;
  user_id?: string | null;
};

type EditDeadlineFormProps = {
  deadline: Deadline;
  document?: DeadlineDocument | null;
  checklistItems?: DeadlineChecklistItem[];
  returnHref?: string;
};

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
      description: "Cette échéance restera prioritaire dans votre cockpit.",
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
      description: "Échéance très proche : gardez un rappel de dernière ligne.",
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

export default function EditDeadlineForm({
  deadline,
  document = null,
  checklistItems: initialChecklistItems = [],
  returnHref = "/deadlines",
}: EditDeadlineFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const initialNotificationDays = useMemo(() => {
    const normalizedDays = normalizeNotificationDays(
      deadline.notification_days ?? []
    );

    return normalizedDays.length > 0
      ? normalizedDays
      : DEFAULT_NOTIFICATION_DAYS;
  }, [deadline.notification_days]);

  const [title, setTitle] = useState(deadline.title);
  const initialCategoryKey = getDeadlineMainCategoryKey({
    category: deadline.category,
    categoryKey: deadline.category_key,
  });
  const [categoryKey, setCategoryKey] = useState<DeadlineCategoryKey>(initialCategoryKey);
  const [customCategoryLabel, setCustomCategoryLabel] = useState(
    deadline.category_key
      ? deadline.custom_category_label ?? ""
      : initialCategoryKey === "other"
        ? deadline.category
        : ""
  );
  const [dueDate, setDueDate] = useState(deadline.due_date);
  const [notificationDays, setNotificationDays] = useState<number[]>(
    initialNotificationDays
  );
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(
    normalizeRecurrenceRule(deadline.recurrence_rule)
  );
  const [importanceLevel, setImportanceLevel] =
    useState<DeadlineImportanceLevel>(
      normalizeDeadlineImportance(deadline.importance_level)
    );
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(
    null
  );
  const [shouldRemoveDocument, setShouldRemoveDocument] = useState(false);
  const [enableDocument, setEnableDocument] = useState(Boolean(document));
  const [enableChecklist, setEnableChecklist] = useState(initialChecklistItems.length > 0);
  const [enableNote, setEnableNote] = useState(Boolean(deadline.treatment_note?.trim()));
  const [enableUsefulLink, setEnableUsefulLink] = useState(Boolean(deadline.useful_link_url?.trim()));
  const [checklistItems, setChecklistItems] = useState<EditableChecklistItem[]>(
    initialChecklistItems.length > 0
      ? initialChecklistItems.map((item) => ({
          id: item.id,
          title: item.title,
          is_completed: item.is_completed,
        }))
      : [{ title: "" }]
  );
  const [treatmentNote, setTreatmentNote] = useState(deadline.treatment_note ?? "");
  const [usefulLinkLabel, setUsefulLinkLabel] = useState(deadline.useful_link_label ?? "");
  const [usefulLinkUrl, setUsefulLinkUrl] = useState(deadline.useful_link_url ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedNotificationDays = useMemo(
    () => normalizeNotificationDays(notificationDays),
    [notificationDays]
  );
  const dateInsight = useMemo(() => getDateInsight(dueDate), [dueDate]);
  const deadlinePreviewTitle = title.trim() || "Échéance sans nom";
  const normalizedCustomCategoryLabel = useMemo(
    () => normalizeCustomCategoryLabel(customCategoryLabel),
    [customCategoryLabel]
  );
  const currentCategoryLabel = useMemo(
    () =>
      getDeadlineCategoryDisplay({
        categoryKey,
        customCategoryLabel: normalizedCustomCategoryLabel,
      }),
    [categoryKey, normalizedCustomCategoryLabel]
  );
  const initialCategoryLabel = useMemo(
    () =>
      getDeadlineCategoryDisplay({
        category: deadline.category,
        categoryKey: deadline.category_key,
        customCategoryLabel: deadline.custom_category_label,
      }),
    [deadline.category, deadline.category_key, deadline.custom_category_label]
  );
  const deadlinePreviewCategory = currentCategoryLabel;

  const normalizedCurrentChecklistItems = useMemo(
    () => (enableChecklist ? normalizeChecklistItems(checklistItems) : []),
    [checklistItems, enableChecklist]
  );
  const normalizedInitialChecklistItems = useMemo(
    () => normalizeChecklistItems(initialChecklistItems.map((item) => ({
      id: item.id,
      title: item.title,
      is_completed: item.is_completed,
    }))),
    [initialChecklistItems]
  );
  const normalizedCurrentTreatmentNote = enableNote ? normalizeTreatmentNote(treatmentNote) : "";
  const normalizedInitialTreatmentNote = normalizeTreatmentNote(deadline.treatment_note);
  const normalizedCurrentUsefulLinkUrl = enableUsefulLink ? normalizeUsefulLinkUrl(usefulLinkUrl) : "";
  const normalizedInitialUsefulLinkUrl = normalizeUsefulLinkUrl(deadline.useful_link_url);
  const normalizedCurrentUsefulLinkLabel = enableUsefulLink ? normalizeUsefulLinkLabel(usefulLinkLabel) : "";
  const normalizedInitialUsefulLinkLabel = normalizeUsefulLinkLabel(deadline.useful_link_label);

  const hasDocumentChanges = Boolean(selectedDocumentFile) || shouldRemoveDocument || enableDocument !== Boolean(document);
  const hasTreatmentChanges =
    normalizedCurrentTreatmentNote !== normalizedInitialTreatmentNote ||
    normalizedCurrentUsefulLinkUrl !== normalizedInitialUsefulLinkUrl ||
    normalizedCurrentUsefulLinkLabel !== normalizedInitialUsefulLinkLabel ||
    JSON.stringify(normalizedCurrentChecklistItems.map(({ id, title, is_completed }) => ({ id, title, is_completed: Boolean(is_completed) }))) !==
      JSON.stringify(normalizedInitialChecklistItems.map(({ id, title, is_completed }) => ({ id, title, is_completed: Boolean(is_completed) })));

  const hasChanges =
    title.trim() !== deadline.title ||
    currentCategoryLabel !== initialCategoryLabel ||
    dueDate !== deadline.due_date ||
    JSON.stringify(normalizedNotificationDays) !==
      JSON.stringify(initialNotificationDays) ||
    recurrenceRule !== normalizeRecurrenceRule(deadline.recurrence_rule) ||
    importanceLevel !== normalizeDeadlineImportance(deadline.importance_level) ||
    hasDocumentChanges ||
    hasTreatmentChanges;

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

    const { error } = await supabase
      .from("deadlines")
      .update({
        title: title.trim(),
        category: storedCategory,
        category_key: safeCategoryKey,
        custom_category_label: normalizedCustomCategoryLabel || null,
        due_date: dueDate,
        notification_days: selectedNotificationDays,
        recurrence_rule: recurrenceRule,
        importance_level: importanceLevel,
        treatment_note: normalizedTreatmentNote || null,
        useful_link_url: normalizedUsefulLinkUrl || null,
        useful_link_label: normalizedUsefulLinkLabel || null,
      })
      .eq("id", deadline.id);

    if (error) {
      console.error(error);
      setErrorMessage(
        "Impossible d’enregistrer les modifications pour le moment. Vérifiez les informations puis réessayez."
      );
      setIsLoading(false);
      return;
    }

    if (enableDocument && selectedDocumentFile) {
      const documentResult = await saveDeadlineDocument({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        file: selectedDocumentFile,
        previousFilePath: document?.file_path,
      });

      if (documentResult.errorMessage) {
        setErrorMessage(documentResult.errorMessage);
        setIsLoading(false);
        return;
      }
    } else if ((!enableDocument || shouldRemoveDocument) && document) {
      const documentResult = await deleteDeadlineDocument({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        filePath: document.file_path,
      });

      if (documentResult.errorMessage) {
        setErrorMessage(documentResult.errorMessage);
        setIsLoading(false);
        return;
      }
    }

    if (enableChecklist) {
      const existingChecklistIds = initialChecklistItems.map((item) => item.id);
      const retainedChecklistIds = normalizedChecklistItems
        .map((item) => item.id)
        .filter((itemId): itemId is number => Boolean(itemId));
      const checklistIdsToDelete = existingChecklistIds.filter(
        (itemId) => !retainedChecklistIds.includes(itemId)
      );

      if (checklistIdsToDelete.length > 0) {
        const { error: deleteChecklistError } = await supabase
          .from("deadline_checklist_items")
          .delete()
          .eq("deadline_id", deadline.id)
          .in("id", checklistIdsToDelete);

        if (deleteChecklistError) {
          console.error(deleteChecklistError);
          setErrorMessage("Impossible de mettre à jour la checklist pour le moment.");
          setIsLoading(false);
          return;
        }
      }

      for (const [index, item] of normalizedChecklistItems.entries()) {
        if (item.id) {
          const { error: updateChecklistError } = await supabase
            .from("deadline_checklist_items")
            .update({ title: item.title, position: index })
            .eq("id", item.id)
            .eq("deadline_id", deadline.id);

          if (updateChecklistError) {
            console.error(updateChecklistError);
            setErrorMessage("Impossible de mettre à jour la checklist pour le moment.");
            setIsLoading(false);
            return;
          }
        } else {
          const { error: insertChecklistError } = await supabase
            .from("deadline_checklist_items")
            .insert({
              deadline_id: deadline.id,
              title: item.title,
              position: index,
              created_by: user.id,
            });

          if (insertChecklistError) {
            console.error(insertChecklistError);
            setErrorMessage("Impossible d’ajouter une étape de checklist pour le moment.");
            setIsLoading(false);
            return;
          }
        }
      }
    } else if (initialChecklistItems.length > 0) {
      const { error: deleteChecklistError } = await supabase
        .from("deadline_checklist_items")
        .delete()
        .eq("deadline_id", deadline.id);

      if (deleteChecklistError) {
        console.error(deleteChecklistError);
        setErrorMessage("Impossible de supprimer la checklist pour le moment.");
        setIsLoading(false);
        return;
      }
    }

    const activityLogs: CreateActivityLogParams[] = [];

    if (title.trim() !== deadline.title) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "deadline.title_updated",
        title: "Nom modifié",
        description: `Le nom est passé de « ${deadline.title} » à « ${title.trim()} ».`,
        metadata: {
          previous_title: deadline.title,
          new_title: title.trim(),
        },
      });
    }

    if (currentCategoryLabel !== initialCategoryLabel) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "deadline.category_updated",
        title: "Catégorie modifiée",
        description: `La catégorie est passée de « ${initialCategoryLabel} » à « ${currentCategoryLabel} ».`,
        metadata: {
          previous_category: initialCategoryLabel,
          new_category: currentCategoryLabel,
          previous_category_key: deadline.category_key ?? null,
          new_category_key: safeCategoryKey,
          new_custom_category_label: normalizedCustomCategoryLabel || null,
        },
      });
    }

    if (dueDate !== deadline.due_date) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "deadline.due_date_updated",
        title: "Date d’échéance modifiée",
        description: `La date est passée du ${deadline.due_date} au ${dueDate}.`,
        metadata: {
          previous_due_date: deadline.due_date,
          new_due_date: dueDate,
        },
      });
    }

    if (
      JSON.stringify(selectedNotificationDays) !==
      JSON.stringify(initialNotificationDays)
    ) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "deadline.reminders_updated",
        title: "Rappels modifiés",
        description: "La configuration des rappels automatiques a été mise à jour.",
        metadata: {
          previous_notification_days: initialNotificationDays,
          new_notification_days: selectedNotificationDays,
        },
      });
    }

    if (recurrenceRule !== normalizeRecurrenceRule(deadline.recurrence_rule)) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "deadline.recurrence_updated",
        title: "Récurrence modifiée",
        description: `La récurrence est passée de « ${RECURRENCE_SHORT_LABELS[normalizeRecurrenceRule(deadline.recurrence_rule)]} » à « ${RECURRENCE_SHORT_LABELS[recurrenceRule]} ».`,
        metadata: {
          previous_recurrence_rule: normalizeRecurrenceRule(deadline.recurrence_rule),
          new_recurrence_rule: recurrenceRule,
        },
      });
    }

    if (importanceLevel !== normalizeDeadlineImportance(deadline.importance_level)) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "deadline.importance_updated",
        title: "Importance modifiée",
        description: `L’importance est passée de « ${DEADLINE_IMPORTANCE_LABELS[normalizeDeadlineImportance(deadline.importance_level)]} » à « ${DEADLINE_IMPORTANCE_LABELS[importanceLevel]} ».`,
        metadata: {
          previous_importance_level: normalizeDeadlineImportance(deadline.importance_level),
          new_importance_level: importanceLevel,
        },
      });
    }

    if (enableDocument && selectedDocumentFile) {
      const isReplacement = Boolean(document);

      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: isReplacement ? "document.replaced" : "document.added",
        title: isReplacement ? "Document remplacé" : "Document ajouté",
        description: isReplacement
          ? `${document?.file_name ?? "Le document précédent"} a été remplacé par ${selectedDocumentFile.name}.`
          : `${selectedDocumentFile.name} a été associé à l’échéance.`,
        metadata: {
          previous_file_name: document?.file_name ?? null,
          new_file_name: selectedDocumentFile.name,
          new_file_size: selectedDocumentFile.size,
        },
      });
    } else if ((!enableDocument || shouldRemoveDocument) && document) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "document.removed",
        title: "Document supprimé",
        description: `${document.file_name} a été retiré de l’échéance.`,
        metadata: {
          file_name: document.file_name,
          file_size: document.file_size,
        },
      });
    }

    if (hasTreatmentChanges) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "deadline.updated",
        title: "Options de traitement modifiées",
        description: "La checklist, la note ou le lien utile de cette échéance a été mis à jour.",
        metadata: {
          checklist_items_count: normalizedChecklistItems.length,
          treatment_note: Boolean(normalizedTreatmentNote),
          useful_link_url: Boolean(normalizedUsefulLinkUrl),
        },
      });
    }

    if (activityLogs.length > 0) {
      await createActivityLogs(activityLogs);
    }

    router.push(returnHref);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                Informations clés
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Mettez à jour le nom, la catégorie ou la date si l’obligation a
                évolué.
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
                maxLength={120}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="mt-2 text-xs text-slate-500">
                Un intitulé précis améliore la recherche et la lisibilité du
                dashboard.
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
              hint="Utilisez le calendrier ou les raccourcis pour ajuster rapidement la date."
            />
          </div>
        </section>

        <DeadlineImportanceSelector
          value={importanceLevel}
          onChange={setImportanceLevel}
          disabled={isLoading}
          stepLabel="Criticité"
        />

        <CollapsibleFormSection
          title="Options complémentaires"
          description="Modifiez le document, la checklist, la note ou le lien utile associé à cette échéance."
          badge="Personnalisation"
          defaultOpen={enableDocument || enableChecklist || enableNote || enableUsefulLink}
        >
          <DeadlineTreatmentOptions
            enableDocument={enableDocument}
            onEnableDocumentChange={(value) => {
              setEnableDocument(value);
              if (!value) {
                setSelectedDocumentFile(null);
                setShouldRemoveDocument(Boolean(document));
              } else {
                setShouldRemoveDocument(false);
              }
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
            selectedFile={selectedDocumentFile}
            onSelectedFileChange={setSelectedDocumentFile}
            existingDocument={document}
            shouldRemoveExistingDocument={shouldRemoveDocument}
            onShouldRemoveExistingDocumentChange={setShouldRemoveDocument}
            disabled={isLoading}
            stepLabel="Document"
          />
        ) : null}

        <CollapsibleFormSection
          title="Rappels et récurrence"
          description="Ajustez les rappels automatiques et la prochaine date proposée au renouvellement."
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
            href={returnHref}
            className="inline-flex justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
          >
            Annuler
          </Link>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center rounded-2xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-blue-500/50"
          >
            {isLoading ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Résumé
              </p>
              <p className="mt-3 line-clamp-2 text-lg font-bold text-white">
                {deadlinePreviewTitle}
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                hasChanges
                  ? "border-blue-400/25 bg-blue-400/10 text-blue-100"
                  : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
              }`}
            >
              {hasChanges ? "Modifié" : "À jour"}
            </span>
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-400">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                Catégorie
              </p>
              <p className="mt-1 text-slate-300">{deadlinePreviewCategory}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                Date
              </p>
              <p className="mt-1 text-slate-300">
                {formatDateForPreview(dueDate)}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                Rappels
              </p>
              <p className="mt-1 text-slate-300">
                {getReminderPreview(normalizedNotificationDays)}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                Récurrence
              </p>
              <p className="mt-1 text-slate-300">
                {RECURRENCE_SHORT_LABELS[recurrenceRule]}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                Importance
              </p>
              <p className="mt-1 text-slate-300">
                {DEADLINE_IMPORTANCE_LABELS[importanceLevel]}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                Document
              </p>
              <p className="mt-1 break-words text-slate-300">
                {enableDocument
                  ? selectedDocumentFile
                    ? selectedDocumentFile.name
                    : shouldRemoveDocument
                      ? "Suppression prévue"
                      : document?.file_name ?? "Document activé sans fichier"
                  : "Document désactivé"}
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-3xl border p-5 ${dateInsight.className}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
            Niveau d’urgence
          </p>
          <p className="mt-3 text-2xl font-bold">{dateInsight.label}</p>
          <p className="mt-2 text-sm leading-6 opacity-80">
            {dateInsight.description}
          </p>
        </div>
      </aside>
    </form>
  );
}
