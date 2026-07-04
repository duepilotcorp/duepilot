"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import DeadlineDocumentField from "@/components/DeadlineDocumentField";
import { createActivityLogs, type CreateActivityLogParams } from "@/lib/activity-logs";
import NotificationDaysSelector, {
  DEFAULT_NOTIFICATION_DAYS,
  normalizeNotificationDays,
} from "@/components/NotificationDaysSelector";
import {
  deleteDeadlineDocument,
  saveDeadlineDocument,
} from "@/lib/deadline-document-actions";
import type { DeadlineDocument } from "@/lib/deadline-documents";
import { createClient } from "@/lib/supabase/client";

const CATEGORY_SUGGESTIONS = [
  "Assurance",
  "Certification",
  "Contrôle réglementaire",
  "Habilitation",
  "Contrat",
  "Vérification périodique",
  "Entretien obligatoire",
  "Document administratif",
  "Qualification professionnelle",
  "Sécurité",
  "Contrôle technique",
];

const DAY_IN_MS = 1000 * 60 * 60 * 24;

type Deadline = {
  id: number;
  title: string;
  category: string;
  due_date: string;
  notification_days?: number[] | null;
  created_at?: string;
  user_id?: string | null;
};

type EditDeadlineFormProps = {
  deadline: Deadline;
  document?: DeadlineDocument | null;
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
  const [category, setCategory] = useState(deadline.category);
  const [dueDate, setDueDate] = useState(deadline.due_date);
  const [notificationDays, setNotificationDays] = useState<number[]>(
    initialNotificationDays
  );
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(
    null
  );
  const [shouldRemoveDocument, setShouldRemoveDocument] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedNotificationDays = useMemo(
    () => normalizeNotificationDays(notificationDays),
    [notificationDays]
  );
  const dateInsight = useMemo(() => getDateInsight(dueDate), [dueDate]);
  const deadlinePreviewTitle = title.trim() || "Échéance sans nom";
  const deadlinePreviewCategory = category.trim() || "Catégorie non définie";

  const hasDocumentChanges = Boolean(selectedDocumentFile) || shouldRemoveDocument;

  const hasChanges =
    title.trim() !== deadline.title ||
    category.trim() !== deadline.category ||
    dueDate !== deadline.due_date ||
    JSON.stringify(normalizedNotificationDays) !==
      JSON.stringify(initialNotificationDays) ||
    hasDocumentChanges;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isLoading) return;

    setErrorMessage("");

    if (!title.trim() || !category.trim() || !dueDate) {
      setErrorMessage("Complétez le nom, la catégorie et la date d’échéance.");
      return;
    }

    const selectedNotificationDays = normalizeNotificationDays(notificationDays);

    if (selectedNotificationDays.length === 0) {
      setErrorMessage("Sélectionnez au moins un rappel automatique.");
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
        category: category.trim(),
        due_date: dueDate,
        notification_days: selectedNotificationDays,
      })
      .eq("id", deadline.id)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      setErrorMessage(
        "Impossible d’enregistrer les modifications pour le moment. Vérifiez les informations puis réessayez."
      );
      setIsLoading(false);
      return;
    }

    if (selectedDocumentFile) {
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
    } else if (shouldRemoveDocument && document) {
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

    if (category.trim() !== deadline.category) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "deadline.category_updated",
        title: "Catégorie modifiée",
        description: `La catégorie est passée de « ${deadline.category} » à « ${category.trim()} ».`,
        metadata: {
          previous_category: deadline.category,
          new_category: category.trim(),
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

    if (selectedDocumentFile) {
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
    } else if (shouldRemoveDocument && document) {
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

    if (activityLogs.length > 0) {
      await createActivityLogs(activityLogs);
    }

    router.push("/deadlines");
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

            <div>
              <label
                htmlFor="category"
                className="mb-2 block text-sm font-semibold text-slate-100"
              >
                Catégorie <span className="text-blue-200">*</span>
              </label>

              <input
                id="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
                maxLength={80}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {CATEGORY_SUGGESTIONS.map((suggestion) => {
                  const isSelected = category.trim() === suggestion;

                  return (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setCategory(suggestion)}
                      disabled={isLoading}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isSelected
                          ? "border-blue-400/50 bg-blue-500/15 text-blue-100"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {suggestion}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="dueDate"
                className="mb-2 block text-sm font-semibold text-slate-100"
              >
                Date d’échéance <span className="text-blue-200">*</span>
              </label>

              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isLoading}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-white outline-none transition focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
        </section>

        <DeadlineDocumentField
          selectedFile={selectedDocumentFile}
          onSelectedFileChange={setSelectedDocumentFile}
          existingDocument={document}
          shouldRemoveExistingDocument={shouldRemoveDocument}
          onShouldRemoveExistingDocumentChange={setShouldRemoveDocument}
          disabled={isLoading}
        />

        <NotificationDaysSelector
          selectedDays={notificationDays}
          onChange={setNotificationDays}
          disabled={isLoading}
          stepLabel="Étape 3/3"
        />

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
                Document
              </p>
              <p className="mt-1 break-words text-slate-300">
                {selectedDocumentFile
                  ? selectedDocumentFile.name
                  : shouldRemoveDocument
                    ? "Suppression prévue"
                    : document?.file_name ?? "Aucun document"}
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
