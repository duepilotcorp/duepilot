"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import {
  formatFileSize,
  getDeadlineDocumentFormatLabel,
  validateDeadlineDocumentFile,
  type DeadlineDocument,
} from "@/lib/deadline-documents";

type DeadlineDocumentFieldProps = {
  selectedFiles: File[];
  onSelectedFilesChange: (files: File[]) => void;
  existingDocuments?: DeadlineDocument[];
  documentIdsToRemove?: number[];
  onDocumentIdsToRemoveChange?: (documentIds: number[]) => void;
  disabled?: boolean;
  stepLabel?: string;
  description?: string;
  emptyDescription?: string;
};

export default function DeadlineDocumentField({
  selectedFiles,
  onSelectedFilesChange,
  existingDocuments = [],
  documentIdsToRemove = [],
  onDocumentIdsToRemoveChange,
  disabled = false,
  stepLabel = "Étape 2/3",
  description = "Joignez les attestations, contrats, certificats, rapports ou images liés à cette échéance.",
  emptyDescription = "L’échéance peut être créée sans document. Vous pourrez en ajouter plus tard depuis la page d’édition.",
}: DeadlineDocumentFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState("");

  const removedDocumentIds = useMemo(
    () => new Set(documentIdsToRemove),
    [documentIdsToRemove]
  );
  const visibleExistingDocuments = existingDocuments.filter(
    (document) => !removedDocumentIds.has(document.id)
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);

    setLocalError("");

    if (files.length === 0) {
      return;
    }

    const invalidFile = files.find((file) => validateDeadlineDocumentFile(file));

    if (invalidFile) {
      setLocalError(validateDeadlineDocumentFile(invalidFile) ?? "Ce document n’est pas valide.");
      event.currentTarget.value = "";
      return;
    }

    const existingKeys = new Set(
      selectedFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
    );
    const nextFiles = [...selectedFiles];

    files.forEach((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (!existingKeys.has(key)) {
        nextFiles.push(file);
        existingKeys.add(key);
      }
    });

    onSelectedFilesChange(nextFiles);
    event.currentTarget.value = "";
  };

  const removeSelectedFile = (fileIndex: number) => {
    setLocalError("");
    onSelectedFilesChange(selectedFiles.filter((_, index) => index !== fileIndex));
  };

  const toggleRemoveExistingDocument = (documentId: number) => {
    if (!onDocumentIdsToRemoveChange) return;

    if (removedDocumentIds.has(documentId)) {
      onDocumentIdsToRemoveChange(documentIdsToRemove.filter((id) => id !== documentId));
      return;
    }

    onDocumentIdsToRemoveChange([...documentIdsToRemove, documentId]);
  };

  const clearSelectedFiles = () => {
    onSelectedFilesChange([]);
    setLocalError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Documents associés</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>

        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
          {stepLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
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
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
            disabled={disabled}
            onChange={handleFileChange}
            className="sr-only"
          />

          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/40 text-2xl text-blue-100">
            ↑
          </span>
          <span className="mt-4 text-sm font-bold text-white">
            Ajouter un ou plusieurs documents
          </span>
          <span className="mt-2 max-w-sm text-xs leading-5 text-slate-400">
            PDF, PNG, JPG, JPEG ou WEBP, 25 Mo maximum par fichier. Les fichiers seront stockés dans l’espace sécurisé de l’utilisateur connecté.
          </span>
        </label>

        <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                État des documents
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {visibleExistingDocuments.length + selectedFiles.length} document{visibleExistingDocuments.length + selectedFiles.length > 1 ? "s" : ""} actif{visibleExistingDocuments.length + selectedFiles.length > 1 ? "s" : ""}
              </p>
            </div>
            {selectedFiles.length > 0 ? (
              <button
                type="button"
                onClick={clearSelectedFiles}
                disabled={disabled}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Retirer les nouveaux fichiers
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}`} className="rounded-2xl border border-blue-400/25 bg-blue-400/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-blue-100">Nouveau document prêt</p>
                    <p className="mt-2 break-words text-sm text-slate-200">{file.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSelectedFile(index)}
                    disabled={disabled}
                    className="w-fit rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            ))}

            {existingDocuments.map((document) => {
              const isRemoved = removedDocumentIds.has(document.id);

              return (
                <div
                  key={document.id}
                  className={`rounded-2xl border p-4 ${
                    isRemoved
                      ? "border-orange-400/25 bg-orange-400/10"
                      : "border-emerald-400/25 bg-emerald-400/10"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${isRemoved ? "text-orange-100" : "text-emerald-100"}`}>
                        {isRemoved ? "Suppression prévue" : "Document actuel"}
                      </p>
                      <p className="mt-2 break-words text-sm text-slate-200">{document.file_name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {getDeadlineDocumentFormatLabel(document.mime_type, document.file_name)} · {formatFileSize(document.file_size)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!isRemoved ? (
                        <a
                          href={`/deadlines/documents/${document.id}`}
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-white"
                        >
                          Voir
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleRemoveExistingDocument(document.id)}
                        disabled={disabled}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          isRemoved
                            ? "border-white/10 bg-white/[0.04] text-slate-100 hover:border-orange-400/40 hover:bg-orange-400/10"
                            : "border-red-500/20 bg-red-500/10 text-red-100 hover:border-red-400/40 hover:bg-red-500/20"
                        }`}
                      >
                        {isRemoved ? "Annuler" : "Supprimer"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {existingDocuments.length === 0 && selectedFiles.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-bold text-slate-200">Aucun document attaché</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{emptyDescription}</p>
              </div>
            ) : null}
          </div>
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
