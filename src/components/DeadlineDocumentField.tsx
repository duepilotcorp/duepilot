"use client";

import { type ChangeEvent, useRef, useState } from "react";
import {
  formatFileSize,
  validateDeadlineDocumentFile,
  type DeadlineDocument,
} from "@/lib/deadline-documents";

type DeadlineDocumentFieldProps = {
  selectedFile: File | null;
  onSelectedFileChange: (file: File | null) => void;
  existingDocument?: DeadlineDocument | null;
  shouldRemoveExistingDocument?: boolean;
  onShouldRemoveExistingDocumentChange?: (shouldRemove: boolean) => void;
  disabled?: boolean;
  stepLabel?: string;
  description?: string;
  emptyDescription?: string;
};

export default function DeadlineDocumentField({
  selectedFile,
  onSelectedFileChange,
  existingDocument = null,
  shouldRemoveExistingDocument = false,
  onShouldRemoveExistingDocumentChange,
  disabled = false,
  stepLabel = "Étape 2/3",
  description = "Joignez l’attestation, le contrat, le certificat, le rapport ou l’image lié à cette échéance.",
  emptyDescription = "L’échéance peut être créée sans document. Vous pourrez en ajouter un plus tard depuis la page d’édition.",
}: DeadlineDocumentFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState("");

  const hasVisibleExistingDocument =
    Boolean(existingDocument) && !shouldRemoveExistingDocument && !selectedFile;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;

    setLocalError("");

    if (!file) {
      onSelectedFileChange(null);
      return;
    }

    const validationError = validateDeadlineDocumentFile(file);

    if (validationError) {
      setLocalError(validationError);
      onSelectedFileChange(null);
      event.currentTarget.value = "";
      return;
    }

    onSelectedFileChange(file);
    onShouldRemoveExistingDocumentChange?.(false);
  };

  const clearSelectedFile = () => {
    onSelectedFileChange(null);
    setLocalError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removeExistingDocument = () => {
    clearSelectedFile();
    onShouldRemoveExistingDocumentChange?.(true);
  };

  const restoreExistingDocument = () => {
    onShouldRemoveExistingDocumentChange?.(false);
    setLocalError("");
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Document associé</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>

        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
          {stepLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr] lg:items-stretch">
        <label
          htmlFor="deadlineDocument"
          className={`group flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed p-6 text-center transition ${
            disabled
              ? "cursor-not-allowed border-white/10 bg-slate-950/30 opacity-60"
              : "border-blue-400/25 bg-blue-400/10 hover:border-blue-300/50 hover:bg-blue-400/15"
          }`}
        >
          <input
            ref={inputRef}
            id="deadlineDocument"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
            disabled={disabled}
            onChange={handleFileChange}
            className="sr-only"
          />

          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/40 text-2xl text-blue-100">
            ↑
          </span>
          <span className="mt-4 text-sm font-bold text-white">
            Ajouter un document
          </span>
          <span className="mt-2 max-w-sm text-xs leading-5 text-slate-400">
            PDF, PNG, JPG, JPEG ou WEBP, 25 Mo maximum. Le fichier sera stocké
            dans l’espace sécurisé de l’utilisateur connecté.
          </span>
        </label>

        <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            État du document
          </p>

          {selectedFile ? (
            <div className="mt-4 rounded-2xl border border-blue-400/25 bg-blue-400/10 p-4">
              <p className="text-sm font-bold text-blue-100">
                Nouveau document prêt
              </p>
              <p className="mt-2 break-words text-sm text-slate-200">
                {selectedFile.name}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {formatFileSize(selectedFile.size)}
              </p>
              <button
                type="button"
                onClick={clearSelectedFile}
                disabled={disabled}
                className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Retirer ce fichier
              </button>
            </div>
          ) : hasVisibleExistingDocument && existingDocument ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
              <p className="text-sm font-bold text-emerald-100">
                Document actuel
              </p>
              <p className="mt-2 break-words text-sm text-slate-200">
                {existingDocument.file_name}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {formatFileSize(existingDocument.file_size)}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`/deadlines/documents/${existingDocument.id}`}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-white"
                >
                  Voir le document
                </a>
                <button
                  type="button"
                  onClick={removeExistingDocument}
                  disabled={disabled}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-400/40 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ) : existingDocument && shouldRemoveExistingDocument ? (
            <div className="mt-4 rounded-2xl border border-orange-400/25 bg-orange-400/10 p-4">
              <p className="text-sm font-bold text-orange-100">
                Suppression prévue
              </p>
              <p className="mt-2 text-sm leading-6 text-orange-100/80">
                Le document actuel sera supprimé lors de l’enregistrement.
              </p>
              <button
                type="button"
                onClick={restoreExistingDocument}
                disabled={disabled}
                className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-orange-400/40 hover:bg-orange-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler la suppression
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-bold text-slate-200">
                Aucun document attaché
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {emptyDescription}
              </p>
            </div>
          )}
        </div>
      </div>

      {localError ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200"
        >
          {localError}
        </div>
      ) : null}
    </section>
  );
}
