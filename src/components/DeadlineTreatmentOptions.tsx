"use client";

import {
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_ITEM_LENGTH,
  MAX_TREATMENT_NOTE_LENGTH,
  MAX_USEFUL_LINK_LABEL_LENGTH,
  MAX_USEFUL_LINK_URL_LENGTH,
  type EditableChecklistItem,
} from "@/lib/deadline-treatment";

type DeadlineTreatmentOptionsProps = {
  enableDocument: boolean;
  onEnableDocumentChange: (value: boolean) => void;
  enableChecklist: boolean;
  onEnableChecklistChange: (value: boolean) => void;
  enableNote: boolean;
  onEnableNoteChange: (value: boolean) => void;
  enableUsefulLink: boolean;
  onEnableUsefulLinkChange: (value: boolean) => void;
  checklistItems: EditableChecklistItem[];
  onChecklistItemsChange: (items: EditableChecklistItem[]) => void;
  treatmentNote: string;
  onTreatmentNoteChange: (value: string) => void;
  usefulLinkLabel: string;
  onUsefulLinkLabelChange: (value: string) => void;
  usefulLinkUrl: string;
  onUsefulLinkUrlChange: (value: string) => void;
  disabled?: boolean;
};

function ToggleCard({
  checked,
  onChange,
  title,
  description,
  icon,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
  icon: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={`flex min-h-full rounded-3xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? "border-blue-300/50 bg-blue-500/15 shadow-lg shadow-blue-950/20"
          : "border-white/10 bg-slate-950/35 hover:border-white/20 hover:bg-white/[0.04]"
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl">
        {icon}
      </span>
      <span className="ml-4 min-w-0">
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          {title}
          <span
            className={`h-2.5 w-2.5 rounded-full ${checked ? "bg-blue-300" : "bg-slate-600"}`}
            aria-hidden="true"
          />
        </span>
        <span className="mt-1 block text-sm leading-6 text-slate-400">{description}</span>
      </span>
    </button>
  );
}

export default function DeadlineTreatmentOptions({
  enableDocument,
  onEnableDocumentChange,
  enableChecklist,
  onEnableChecklistChange,
  enableNote,
  onEnableNoteChange,
  enableUsefulLink,
  onEnableUsefulLinkChange,
  checklistItems,
  onChecklistItemsChange,
  treatmentNote,
  onTreatmentNoteChange,
  usefulLinkLabel,
  onUsefulLinkLabelChange,
  usefulLinkUrl,
  onUsefulLinkUrlChange,
  disabled = false,
}: DeadlineTreatmentOptionsProps) {
  const updateChecklistTitle = (index: number, title: string) => {
    onChecklistItemsChange(
      checklistItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, title } : item
      )
    );
  };

  const addChecklistItem = () => {
    if (checklistItems.length >= MAX_CHECKLIST_ITEMS) return;
    onChecklistItemsChange([...checklistItems, { title: "" }]);
  };

  const removeChecklistItem = (index: number) => {
    onChecklistItemsChange(checklistItems.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Options complémentaires</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Activez uniquement les blocs utiles pour cette échéance. DuePilot affichera ensuite seulement les éléments renseignés sur la fiche détail.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
          Personnalisation
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ToggleCard
          checked={enableDocument}
          onChange={onEnableDocumentChange}
          title="Ajouter un document"
          description="Joindre un PDF, une image ou une capture utile au suivi."
          icon="📎"
          disabled={disabled}
        />
        <ToggleCard
          checked={enableChecklist}
          onChange={onEnableChecklistChange}
          title="Ajouter une checklist"
          description="Lister les étapes concrètes à faire avant de clôturer."
          icon="☑"
          disabled={disabled}
        />
        <ToggleCard
          checked={enableNote}
          onChange={onEnableNoteChange}
          title="Ajouter une note"
          description="Conserver une consigne, un contexte ou une précision interne."
          icon="✎"
          disabled={disabled}
        />
        <ToggleCard
          checked={enableUsefulLink}
          onChange={onEnableUsefulLinkChange}
          title="Ajouter un lien utile"
          description="Garder l’accès vers un portail client, une banque ou un fournisseur."
          icon="↗"
          disabled={disabled}
        />
      </div>

      {enableChecklist ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-white">Checklist de traitement</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Ajoutez jusqu’à {MAX_CHECKLIST_ITEMS} étapes. Elles pourront être cochées directement depuis la fiche échéance.
              </p>
            </div>
            <button
              type="button"
              onClick={addChecklistItem}
              disabled={disabled || checklistItems.length >= MAX_CHECKLIST_ITEMS}
              className="inline-flex justify-center rounded-xl border border-blue-400/25 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ajouter une étape
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {checklistItems.length > 0 ? (
              checklistItems.map((item, index) => (
                <div key={item.id ?? `new-${index}`} className="flex gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-bold text-slate-300">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(event) => updateChecklistTitle(index, event.target.value)}
                    disabled={disabled}
                    maxLength={MAX_CHECKLIST_ITEM_LENGTH}
                    placeholder="Ex : Contacter le fournisseur"
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(index)}
                    disabled={disabled}
                    className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 text-sm font-semibold text-red-100 transition hover:border-red-400/40 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Retirer cette étape"
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
                Aucune étape pour le moment. Ajoutez une première action si cette échéance nécessite plusieurs tâches.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {enableNote ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <label htmlFor="treatmentNote" className="font-semibold text-white">
            Note de traitement
          </label>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Une note interne visible sur la fiche échéance. Idéal pour préciser le contexte, la personne à contacter ou la procédure à suivre.
          </p>
          <textarea
            id="treatmentNote"
            value={treatmentNote}
            onChange={(event) => onTreatmentNoteChange(event.target.value)}
            disabled={disabled}
            maxLength={MAX_TREATMENT_NOTE_LENGTH}
            rows={5}
            placeholder="Ex : Demander l’attestation à la banque avant validation finale."
            className="mt-4 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-slate-500">
            {treatmentNote.length}/{MAX_TREATMENT_NOTE_LENGTH} caractères
          </p>
        </div>
      ) : null}

      {enableUsefulLink ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <p className="font-semibold text-white">Lien utile</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Ajoutez un lien vers un portail, un espace client, une banque, un fournisseur ou un outil externe.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <label htmlFor="usefulLinkLabel" className="mb-2 block text-sm font-semibold text-slate-100">
                Libellé
              </label>
              <input
                id="usefulLinkLabel"
                type="text"
                value={usefulLinkLabel}
                onChange={(event) => onUsefulLinkLabelChange(event.target.value)}
                disabled={disabled}
                maxLength={MAX_USEFUL_LINK_LABEL_LENGTH}
                placeholder="Ex : Portail fournisseur"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="usefulLinkUrl" className="mb-2 block text-sm font-semibold text-slate-100">
                URL
              </label>
              <input
                id="usefulLinkUrl"
                type="text"
                value={usefulLinkUrl}
                onChange={(event) => onUsefulLinkUrlChange(event.target.value)}
                disabled={disabled}
                maxLength={MAX_USEFUL_LINK_URL_LENGTH}
                placeholder="https://..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
