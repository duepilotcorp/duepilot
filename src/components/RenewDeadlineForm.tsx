"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import DateField from "@/components/DateField";
import DeadlineDocumentField from "@/components/DeadlineDocumentField";
import {
  createActivityLogs,
  type CreateActivityLogParams,
} from "@/lib/activity-logs";
import {
  deleteDeadlineDocument,
  saveDeadlineDocument,
} from "@/lib/deadline-document-actions";
import type { DeadlineDocument } from "@/lib/deadline-documents";
import {
  createRenewalHistory,
  type RenewalDocumentAction,
} from "@/lib/renewal-history";
import { getNextRecurringDate, getRecurrenceShortLabel, normalizeRecurrenceRule } from "@/lib/recurrence";
import { createClient } from "@/lib/supabase/client";

type DeadlineForRenewal = {
  id: number;
  title: string;
  category: string | null;
  due_date: string;
  notification_days: number[] | null;
  recurrence_rule?: string | null;
};

type RenewDeadlineFormProps = {
  deadline: DeadlineForRenewal;
  document?: DeadlineDocument | null;
};

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

function getTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function getRenewalInsight(date: string) {
  const daysUntilDueDate = getDaysUntilDueDate(date);

  if (daysUntilDueDate === null) {
    return {
      label: "Nouvelle date à définir",
      description:
        "Choisissez la prochaine date d’échéance pour relancer le suivi et les rappels automatiques.",
      className: "border-white/10 bg-white/[0.03] text-slate-300",
    };
  }

  if (daysUntilDueDate < 0) {
    return {
      label: "Date passée",
      description:
        "La nouvelle échéance doit être aujourd’hui ou dans le futur pour relancer un suivi fiable.",
      className: "border-red-400/25 bg-red-400/10 text-red-100",
    };
  }

  if (daysUntilDueDate === 0) {
    return {
      label: "Nouvelle échéance aujourd’hui",
      description:
        "Cette date est valide, mais elle déclenchera un suivi très immédiat. À utiliser uniquement si c’est volontaire.",
      className: "border-orange-400/25 bg-orange-400/10 text-orange-100",
    };
  }

  if (daysUntilDueDate <= 30) {
    return {
      label: `Nouvelle échéance dans ${daysUntilDueDate} jours`,
      description:
        "Le suivi sera relancé sur cette date avec les rappels déjà configurés pour cette échéance.",
      className: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
    };
  }

  return {
    label: `Nouvelle échéance dans ${daysUntilDueDate} jours`,
    description:
      "Le suivi repartira proprement sur cette nouvelle date. Les anciens rappels restent conservés dans l’historique.",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  };
}

function normalizeNotificationDays(days: number[] | null) {
  return Array.from(
    new Set(
      (days ?? [])
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 365)
    )
  ).sort((firstDay, secondDay) => secondDay - firstDay);
}

function formatReminder(day: number) {
  if (day === 0) return "Jour J";
  return `J-${day}`;
}

export default function RenewDeadlineForm({
  deadline,
  document = null,
}: RenewDeadlineFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isOpen, setIsOpen] = useState(false);
  const [renewalDate, setRenewalDate] = useState("");
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(
    null
  );
  const [shouldRemoveDocument, setShouldRemoveDocument] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const todayInputValue = useMemo(() => getTodayInputValue(), []);
  const renewalInsight = useMemo(
    () => getRenewalInsight(renewalDate),
    [renewalDate]
  );
  const normalizedNotificationDays = useMemo(
    () => normalizeNotificationDays(deadline.notification_days),
    [deadline.notification_days]
  );
  const recurrenceRule = normalizeRecurrenceRule(deadline.recurrence_rule);
  const suggestedRenewalDate = getNextRecurringDate(deadline.due_date, recurrenceRule);
  const recurrencePreview = getRecurrenceShortLabel(recurrenceRule);
  const reminderPreview =
    normalizedNotificationDays.length > 0
      ? normalizedNotificationDays.map(formatReminder).join(" · ")
      : "Aucun rappel configuré";

  const resetForm = () => {
    setRenewalDate("");
    setSelectedDocumentFile(null);
    setShouldRemoveDocument(false);
    setErrorMessage("");
  };

  const closeForm = () => {
    if (isLoading) return;

    resetForm();
    setIsOpen(false);
  };

  const toggleForm = () => {
    if (isLoading) return;

    setIsOpen((currentValue) => {
      if (currentValue) {
        resetForm();
        return false;
      }

      setRenewalDate(suggestedRenewalDate);
      setErrorMessage("");
      return true;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    setErrorMessage("");

    if (!renewalDate) {
      setErrorMessage("Choisissez la prochaine date d’échéance.");
      return;
    }

    if (renewalDate === deadline.due_date) {
      setErrorMessage(
        "La nouvelle date doit être différente de la date actuelle."
      );
      return;
    }

    const selectedDate = parseLocalDate(renewalDate);
    const today = parseLocalDate(todayInputValue);

    if (selectedDate.getTime() < today.getTime()) {
      setErrorMessage(
        "La nouvelle date d’échéance doit être aujourd’hui ou dans le futur."
      );
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

    let newDocumentFilePath: string | null = null;

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

      newDocumentFilePath = documentResult.filePath ?? null;
    } else if (shouldRemoveDocument && document) {
      const deleteResult = await deleteDeadlineDocument({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        filePath: document.file_path,
      });

      if (deleteResult.errorMessage) {
        setErrorMessage(deleteResult.errorMessage);
        setIsLoading(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("deadlines")
      .update({
        due_date: renewalDate,
        workflow_status: "open",
        claimed_by: null,
        claimed_at: null,
        completed_by: null,
        completed_at: null,
      })
      .eq("id", deadline.id);

    if (updateError) {
      console.error(updateError);
      setErrorMessage(
        "Impossible de renouveler cette échéance pour le moment. Réessayez dans quelques instants."
      );
      setIsLoading(false);
      return;
    }

    const activityLogs: CreateActivityLogParams[] = [
      {
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "deadline.renewed",
        title: "Échéance traitée et renouvelée",
        description: `${deadline.title} a été marquée comme traitée et reportée au ${formatDateForPreview(renewalDate)}.`,
        metadata: {
          previous_due_date: deadline.due_date,
          new_due_date: renewalDate,
          recurrence_rule: recurrenceRule,
          reminders: normalizedNotificationDays,
        },
      },
    ];

    if (selectedDocumentFile) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: document ? "document.replaced" : "document.added",
        title: document ? "Document remplacé" : "Document ajouté",
        description: document
          ? `${document.file_name} a été remplacé par ${selectedDocumentFile.name} lors du renouvellement.`
          : `${selectedDocumentFile.name} a été associé lors du renouvellement.`,
        metadata: {
          previous_file_name: document?.file_name ?? null,
          new_file_name: selectedDocumentFile.name,
          new_file_size: selectedDocumentFile.size,
          source: "renewal",
        },
      });
    } else if (shouldRemoveDocument && document) {
      activityLogs.push({
        supabase,
        userId: user.id,
        deadlineId: deadline.id,
        action: "document.removed",
        title: "Document supprimé",
        description: `${document.file_name} a été retiré lors du renouvellement.`,
        metadata: {
          file_name: document.file_name,
          file_size: document.file_size,
          source: "renewal",
        },
      });
    }

    await createActivityLogs(activityLogs);

    const documentAction: RenewalDocumentAction = selectedDocumentFile
      ? document
        ? "replaced"
        : "added"
      : shouldRemoveDocument && document
        ? "removed"
        : document
          ? "kept"
          : "none";

    await createRenewalHistory({
      supabase,
      userId: user.id,
      deadlineId: deadline.id,
      deadlineTitle: deadline.title,
      deadlineCategory: deadline.category,
      previousDueDate: deadline.due_date,
      newDueDate: renewalDate,
      previousDocumentFileName: document?.file_name ?? null,
      previousDocumentFileSize: document?.file_size ?? null,
      previousDocumentFilePath: document?.file_path ?? null,
      newDocumentFileName: selectedDocumentFile
        ? selectedDocumentFile.name
        : shouldRemoveDocument
          ? null
          : document?.file_name ?? null,
      newDocumentFileSize: selectedDocumentFile
        ? selectedDocumentFile.size
        : shouldRemoveDocument
          ? null
          : document?.file_size ?? null,
      newDocumentFilePath: selectedDocumentFile
        ? newDocumentFilePath
        : shouldRemoveDocument
          ? null
          : document?.file_path ?? null,
      documentAction,
      reminders: normalizedNotificationDays,
      metadata: {
        source: "renewal_flow",
        recurrence_rule: recurrenceRule,
      },
    });

    resetForm();
    setIsOpen(false);
    setIsLoading(false);
    router.refresh();
  };

  return (
    <section id="renewal-action" className="mt-6 scroll-mt-8 overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-slate-900/85 shadow-2xl shadow-emerald-950/10">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
Action terminée
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">
Clôturer cette échéance et planifier la suivante
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            À utiliser uniquement lorsque l’obligation est réellement faite : assurance renouvelée, contrôle réalisé, contrat reconduit ou document mis à jour. DuePilot garde la trace de l’action, remplace la date actuelle par la prochaine échéance et relance les rappels sur ce nouveau cycle.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-bold text-white">1. Action faite</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                L’obligation actuelle est considérée comme traitée.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-bold text-white">2. Nouvelle date</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Vous indiquez la prochaine échéance à surveiller.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-bold text-white">3. Suivi relancé</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Les rappels repartent automatiquement sur le nouveau cycle.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleForm}
          className="inline-flex justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-300/20 lg:mt-8"
        >
          {isOpen ? "Fermer" : "J’ai traité cette échéance"}
        </button>
      </div>

      {isOpen ? (
        <form
          onSubmit={handleSubmit}
          className="border-t border-emerald-300/15 bg-slate-950/35 p-6 sm:p-8"
        >
          <div className="mb-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
            <p className="text-sm font-bold text-emerald-50">
              Ce n’est pas une modification classique.
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-50/75">
              Pour corriger le titre, la catégorie, la date actuelle ou les rappels, utilisez “Modifier l’échéance”. Ici, vous confirmez que le cycle actuel est terminé et vous programmez la prochaine date à suivre.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Prochain cycle de suivi
                    </p>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
                      Renseignez la date à laquelle cette obligation devra être suivie à nouveau.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                    Date obligatoire
                  </span>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <DateField
                    id="renewalDate"
                    label="Prochaine date d’échéance"
                    value={renewalDate}
                    min={todayInputValue}
                    onChange={setRenewalDate}
                    disabled={isLoading}
                    required
                    accent="emerald"
                    hint={`Date actuelle : ${formatDateForPreview(deadline.due_date)}. Récurrence : ${recurrencePreview}.`}
                  />

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Rappels conservés
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {reminderPreview}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-emerald-100/90">
                      {suggestedRenewalDate
                        ? `Date suggérée : ${formatDateForPreview(suggestedRenewalDate)}`
                        : "Aucune date automatique"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Vous pourrez ajuster les rappels depuis la page de
                      modification si nécessaire.
                    </p>
                  </div>
                </div>
              </section>

              <DeadlineDocumentField
                selectedFiles={selectedDocumentFile ? [selectedDocumentFile] : []}
                onSelectedFilesChange={(files) => setSelectedDocumentFile(files[0] ?? null)}
                existingDocuments={document ? [document] : []}
                documentIdsToRemove={shouldRemoveDocument && document ? [document.id] : []}
                onDocumentIdsToRemoveChange={(documentIds) => setShouldRemoveDocument(Boolean(document && documentIds.includes(document.id)))}
                disabled={isLoading}
                stepLabel="Optionnel"
                description="Conservez les documents actuels ou ajoutez le nouveau justificatif lié au renouvellement."
                emptyDescription="Vous pouvez renouveler cette échéance sans document et ajouter le justificatif plus tard."
              />

              {errorMessage ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200"
                >
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isLoading}
                  className="inline-flex justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex justify-center rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:bg-emerald-400/50"
                >
                  {isLoading
                    ? "Enregistrement..."
                    : "Clôturer et relancer le suivi"}
                </button>
              </div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              <div className={`rounded-3xl border p-5 ${renewalInsight.className}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                  Aperçu
                </p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {renewalInsight.label}
                </p>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {renewalInsight.description}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Différence avec “Modifier”
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  <li>• “Modifier” corrige les informations de l’échéance actuelle</li>
                  <li>• Cette action confirme que l’échéance actuelle est faite</li>
                  <li>• La date actuelle est remplacée par la prochaine date à suivre</li>
                  <li>• Le journal d’activité conserve la trace du renouvellement</li>
                </ul>
              </div>
            </aside>
          </div>
        </form>
      ) : null}
    </section>
  );
}
