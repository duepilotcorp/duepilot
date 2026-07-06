"use client";

import { useMemo, useState } from "react";
import {
  getChecklistCompletion,
  type DeadlineChecklistItem,
} from "@/lib/deadline-treatment";
import { updateDeadlineChecklistItemCompletion } from "@/lib/deadline-treatment-actions";

type DeadlineTreatmentPanelProps = {
  deadlineId: number;
  checklistItems: DeadlineChecklistItem[];
  treatmentNote?: string | null;
  usefulLinkUrl?: string | null;
  usefulLinkLabel?: string | null;
  canEdit?: boolean;
};

function getSafeExternalHref(url: string) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      return parsedUrl.toString();
    }
  } catch {
    return "";
  }

  return "";
}

export default function DeadlineTreatmentPanel({
  deadlineId,
  checklistItems,
  treatmentNote = null,
  usefulLinkUrl = null,
  usefulLinkLabel = null,
  canEdit = false,
}: DeadlineTreatmentPanelProps) {
  const [items, setItems] = useState(checklistItems);
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const completion = useMemo(() => getChecklistCompletion(items), [items]);
  const note = treatmentNote?.trim() ?? "";
  const safeUrl = usefulLinkUrl ? getSafeExternalHref(usefulLinkUrl) : "";
  const linkLabel = usefulLinkLabel?.trim() || "Ouvrir le lien utile";
  const hasChecklist = items.length > 0;

  if (!hasChecklist && !note && !safeUrl) {
    return null;
  }

  const toggleItem = async (item: DeadlineChecklistItem) => {
    if (!canEdit || pendingItemId) return;

    setPendingItemId(item.id);
    setErrorMessage("");

    const nextCompletedState = !item.is_completed;
    const result = await updateDeadlineChecklistItemCompletion({
      deadlineId,
      itemId: item.id,
      isCompleted: nextCompletedState,
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      setPendingItemId(null);
      return;
    }

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              is_completed: nextCompletedState,
              completed_at: result.completedAt,
              completed_by: result.completedBy,
            }
          : currentItem
      )
    );
    setPendingItemId(null);
  };

  return (
    <section className="mt-8 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-slate-900/90 to-blue-500/10 p-6 shadow-2xl shadow-cyan-950/20 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
            Traitement personnalisé
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">
            Plan de traitement
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Les éléments ci-dessous ont été ajoutés manuellement à cette échéance : checklist, note ou lien utile.
          </p>
        </div>

        {hasChecklist ? (
          <div className="w-full rounded-3xl border border-white/10 bg-slate-950/35 p-4 lg:w-72">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Checklist
                </p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {completion.completed}/{completion.total}
                </p>
              </div>
              <p className="text-sm font-semibold text-cyan-100">
                {completion.percent}%
              </p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all"
                style={{ width: `${completion.percent}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-5">
        {hasChecklist ? (
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Checklist</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Cochez les actions au fil du traitement.
                </p>
              </div>
              {!canEdit ? (
                <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                  Lecture seule
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {items.map((item) => (
                <label
                  key={item.id}
                  className={`flex min-h-24 gap-3 rounded-2xl border p-4 transition ${
                    item.is_completed
                      ? "border-emerald-400/25 bg-emerald-400/10"
                      : "border-white/10 bg-slate-950/35"
                  } ${canEdit ? "cursor-pointer hover:border-cyan-300/35 hover:bg-cyan-400/10" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={item.is_completed}
                    onChange={() => toggleItem(item)}
                    disabled={!canEdit || pendingItemId === item.id}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-950 text-cyan-400 focus:ring-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <span className="min-w-0">
                    <span className={`block break-words text-sm font-semibold leading-5 ${item.is_completed ? "text-emerald-50 line-through decoration-emerald-200/60" : "text-white"}`}>
                      {item.title}
                    </span>
                    {item.is_completed ? (
                      <span className="mt-2 block text-xs text-emerald-100/70">
                        Étape terminée
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {note ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Note de traitement
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-slate-200">
              {note}
            </p>
          </div>
        ) : null}

        {safeUrl ? (
          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Lien utile
              </p>
              <a
                href={safeUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 block break-all text-sm leading-6 text-cyan-100 underline decoration-cyan-200/30 underline-offset-4 transition hover:text-white hover:decoration-cyan-100"
              >
                {safeUrl}
              </a>
            </div>
            <a
              href={safeUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex shrink-0 justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-400/15 hover:text-white"
            >
              {linkLabel}
            </a>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
          {errorMessage}
        </div>
      ) : null}
    </section>
  );
}
