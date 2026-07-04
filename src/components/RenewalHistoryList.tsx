"use client";

import { useMemo, useState } from "react";
import { formatFileSize } from "@/lib/deadline-documents";
import type { RenewalDocumentAction, RenewalHistory } from "@/lib/renewal-history";

type RenewalHistoryListProps = {
  renewals: RenewalHistory[];
  initialVisibleCount?: number;
};

function parseLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date(date);
  }

  return new Date(year, month - 1, day);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parseLocalDate(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getDocumentActionLabel(action: RenewalDocumentAction) {
  const labels: Record<RenewalDocumentAction, string> = {
    kept: "Document conservé",
    added: "Document ajouté",
    replaced: "Document remplacé",
    removed: "Document retiré",
    none: "Aucun document",
  };

  return labels[action];
}

function getDocumentActionClasses(action: RenewalDocumentAction) {
  if (action === "added" || action === "replaced") {
    return "border-blue-400/20 bg-blue-400/10 text-blue-100";
  }

  if (action === "removed") {
    return "border-orange-400/20 bg-orange-400/10 text-orange-100";
  }

  if (action === "kept") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function getDocumentSummary(renewal: RenewalHistory) {
  if (renewal.document_action === "replaced") {
    return {
      label: "Remplacement",
      value: `${renewal.previous_document_file_name ?? "Ancien document"} → ${renewal.new_document_file_name ?? "Nouveau document"}`,
      helper: renewal.new_document_file_size
        ? formatFileSize(renewal.new_document_file_size)
        : null,
    };
  }

  if (renewal.document_action === "added") {
    return {
      label: "Nouveau document",
      value: renewal.new_document_file_name ?? "Document ajouté",
      helper: renewal.new_document_file_size
        ? formatFileSize(renewal.new_document_file_size)
        : null,
    };
  }

  if (renewal.document_action === "removed") {
    return {
      label: "Document retiré",
      value: renewal.previous_document_file_name ?? "Document supprimé",
      helper: renewal.previous_document_file_size
        ? formatFileSize(renewal.previous_document_file_size)
        : null,
    };
  }

  if (renewal.document_action === "kept") {
    return {
      label: "Document conservé",
      value: renewal.previous_document_file_name ?? "Document existant conservé",
      helper: renewal.previous_document_file_size
        ? formatFileSize(renewal.previous_document_file_size)
        : null,
    };
  }

  return {
    label: "Document",
    value: "Aucun document associé à ce renouvellement",
    helper: null,
  };
}

function formatReminder(day: number) {
  if (day === 0) return "Jour J";
  return `J-${day}`;
}

function getRemindersLabel(reminders: number[] | null) {
  if (!reminders || reminders.length === 0) {
    return "Aucun rappel";
  }

  return reminders.map(formatReminder).join(" · ");
}

export default function RenewalHistoryList({
  renewals,
  initialVisibleCount = 3,
}: RenewalHistoryListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasMoreRenewals = renewals.length > initialVisibleCount;
  const visibleRenewals = useMemo(
    () => (isExpanded ? renewals : renewals.slice(0, initialVisibleCount)),
    [initialVisibleCount, isExpanded, renewals]
  );

  if (renewals.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <p className="font-semibold text-white">
          Aucun renouvellement archivé pour le moment.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Quand vous clôturerez une échéance et planifierez la suivante,
          DuePilot conservera ici l’ancienne date, la nouvelle date et le
          document concerné.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visibleRenewals.map((renewal) => {
        const documentSummary = getDocumentSummary(renewal);

        return (
          <article
            key={renewal.id}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition duration-200 hover:border-white/15 hover:bg-white/[0.05]"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                    Renouvelée
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getDocumentActionClasses(
                      renewal.document_action
                    )}`}
                  >
                    {getDocumentActionLabel(renewal.document_action)}
                  </span>
                </div>

                <p className="mt-4 text-lg font-bold text-white">
                  {formatDate(renewal.previous_due_date)} → {formatDate(renewal.new_due_date)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Cycle clôturé le {formatDateTime(renewal.created_at)}.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300 lg:min-w-56">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Rappels relancés
                </p>
                <p className="mt-2 font-semibold text-slate-100">
                  {getRemindersLabel(renewal.reminders)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/25 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {documentSummary.label}
              </p>
              <p className="mt-2 break-words text-sm font-semibold text-slate-100">
                {documentSummary.value}
              </p>
              {documentSummary.helper ? (
                <p className="mt-1 text-xs text-slate-500">
                  {documentSummary.helper}
                </p>
              ) : null}
            </div>
          </article>
        );
      })}

      {hasMoreRenewals ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
          className="inline-flex w-full justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
        >
          {isExpanded
            ? "Réduire aux derniers renouvellements"
            : `Voir tout l’historique (${renewals.length})`}
        </button>
      ) : null}
    </div>
  );
}
