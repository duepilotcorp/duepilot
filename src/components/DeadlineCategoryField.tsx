import {
  DEADLINE_CATEGORY_OPTIONS,
  getDeadlineCategoryOption,
  type DeadlineCategoryKey,
} from "@/lib/deadline-categories";

type DeadlineCategoryFieldProps = {
  categoryKey: string;
  customCategoryLabel: string;
  onCategoryKeyChange: (value: DeadlineCategoryKey) => void;
  onCustomCategoryLabelChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  stepLabel?: string;
};

export default function DeadlineCategoryField({
  categoryKey,
  customCategoryLabel,
  onCategoryKeyChange,
  onCustomCategoryLabelChange,
  disabled = false,
  required = false,
  stepLabel = "Catégorie",
}: DeadlineCategoryFieldProps) {
  const selectedCategory = getDeadlineCategoryOption(categoryKey);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{stepLabel}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Choisissez une catégorie principale pour garder des filtres propres, puis ajoutez un libellé libre si nécessaire.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          Filtres V2
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Catégorie principale {required ? <span className="text-blue-200">*</span> : null}
          </span>
          <select
            name="categoryKey"
            value={categoryKey}
            onChange={(event) => onCategoryKeyChange(event.target.value as DeadlineCategoryKey)}
            disabled={disabled}
            required={required}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-blue-400/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {DEADLINE_CATEGORY_OPTIONS.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Libellé personnalisé
          </span>
          <input
            type="text"
            value={customCategoryLabel}
            onChange={(event) => onCustomCategoryLabelChange(event.target.value)}
            disabled={disabled}
            autoComplete="off"
            maxLength={80}
            placeholder="Ex : Visite médicale salariés, attestation banque, contrat Orange…"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-white">{selectedCategory.label}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{selectedCategory.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedCategory.examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onCustomCategoryLabelChange(example)}
              disabled={disabled}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
