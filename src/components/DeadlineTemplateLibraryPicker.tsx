"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEADLINE_CATEGORY_OPTIONS,
  getDeadlineCategoryDisplay,
  type DeadlineCategoryKey,
} from "@/lib/deadline-categories";
import {
  DEADLINE_IMPORTANCE_LABELS,
  type DeadlineImportanceLevel,
} from "@/lib/deadline-importance";
import { RECURRENCE_SHORT_LABELS, type RecurrenceRule } from "@/lib/recurrence";
import {
  DEADLINE_TEMPLATE_VISIBILITY_LABELS,
  getDeadlineTemplateReminderSummary,
  normalizeDeadlineTemplateRows,
  type DeadlineTemplateLibraryItem,
  type DeadlineTemplateLibraryRow,
  type DeadlineTemplateVisibility,
} from "@/lib/deadline-template-library";
import { createClient } from "@/lib/supabase/client";

type DeadlineTemplateLibraryPickerProps = {
  selectedTemplateId?: string | null;
  initialTemplateId?: string | null;
  disabled?: boolean;
  onSelectTemplate: (template: DeadlineTemplateLibraryItem) => void;
};

type CategoryFilter = "all" | DeadlineCategoryKey;
type ImportanceFilter = "all" | DeadlineImportanceLevel;
type RecurrenceFilter = "all" | RecurrenceRule;
type VisibilityFilter = "all" | DeadlineTemplateVisibility;

const IMPORTANCE_FILTERS: { value: ImportanceFilter; label: string }[] = [
  { value: "all", label: "Toutes criticités" },
  { value: "normal", label: DEADLINE_IMPORTANCE_LABELS.normal },
  { value: "high", label: DEADLINE_IMPORTANCE_LABELS.high },
  { value: "critical", label: DEADLINE_IMPORTANCE_LABELS.critical },
];

const RECURRENCE_FILTERS: { value: RecurrenceFilter; label: string }[] = [
  { value: "all", label: "Toutes récurrences" },
  { value: "none", label: RECURRENCE_SHORT_LABELS.none },
  { value: "monthly", label: RECURRENCE_SHORT_LABELS.monthly },
  { value: "quarterly", label: RECURRENCE_SHORT_LABELS.quarterly },
  { value: "semiannual", label: RECURRENCE_SHORT_LABELS.semiannual },
  { value: "yearly", label: RECURRENCE_SHORT_LABELS.yearly },
];

const VISIBILITY_FILTERS: { value: VisibilityFilter; label: string }[] = [
  { value: "all", label: "Tous les modèles" },
  { value: "personal", label: "Personnels" },
  { value: "organization", label: "Équipe" },
];

function normalizeSearch(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getVisibilityClassName(visibility: DeadlineTemplateVisibility) {
  if (visibility === "organization") {
    return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  }

  return "border-violet-400/25 bg-violet-400/10 text-violet-100";
}

export default function DeadlineTemplateLibraryPicker({
  selectedTemplateId = null,
  initialTemplateId = null,
  disabled = false,
  onSelectTemplate,
}: DeadlineTemplateLibraryPickerProps) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<DeadlineTemplateLibraryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>("all");
  const [recurrenceFilter, setRecurrenceFilter] = useState<RecurrenceFilter>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const appliedInitialTemplateIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTemplates() {
      setIsLoadingTemplates(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("deadline_templates")
        .select(
          "id, organization_id, created_by, visibility, name, title, description, category, category_key, custom_category_label, notification_days, recurrence_rule, importance_level, treatment_note, useful_link_url, useful_link_label, checklist_items, created_at, updated_at"
        )
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error(error);
        setTemplates([]);
        setErrorMessage(
          "Impossible de charger votre bibliothèque. Vérifiez que la migration SQL a bien été exécutée."
        );
        setIsLoadingTemplates(false);
        return;
      }

      setTemplates(normalizeDeadlineTemplateRows((data ?? []) as DeadlineTemplateLibraryRow[]));
      setIsLoadingTemplates(false);
    }

    loadTemplates();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return templates.find((template) => String(template.id) === selectedTemplateId) ?? null;
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!initialTemplateId || isLoadingTemplates) return;
    if (appliedInitialTemplateIdRef.current === initialTemplateId) return;

    const templateToApply = templates.find(
      (template) => String(template.id) === initialTemplateId
    );

    if (!templateToApply) return;

    appliedInitialTemplateIdRef.current = initialTemplateId;
    onSelectTemplate(templateToApply);
  }, [initialTemplateId, isLoadingTemplates, onSelectTemplate, templates]);

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchQuery);

    return templates.filter((template) => {
      if (categoryFilter !== "all" && template.category_key !== categoryFilter) return false;
      if (importanceFilter !== "all" && template.importance_level !== importanceFilter) return false;
      if (recurrenceFilter !== "all" && template.recurrence_rule !== recurrenceFilter) return false;
      if (visibilityFilter !== "all" && template.visibility !== visibilityFilter) return false;

      if (!normalizedSearch) return true;

      const searchableContent = normalizeSearch(
        [
          template.name,
          template.title,
          template.description,
          template.category,
          template.custom_category_label,
          DEADLINE_IMPORTANCE_LABELS[template.importance_level],
          RECURRENCE_SHORT_LABELS[template.recurrence_rule],
          DEADLINE_TEMPLATE_VISIBILITY_LABELS[template.visibility],
          ...template.checklist_items.map((item) => item.title),
        ]
          .filter(Boolean)
          .join(" ")
      );

      return searchableContent.includes(normalizedSearch);
    });
  }, [categoryFilter, importanceFilter, recurrenceFilter, searchQuery, templates, visibilityFilter]);

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setImportanceFilter("all");
    setRecurrenceFilter("all");
    setVisibilityFilter("all");
  };

  return (
    <section className="rounded-3xl border border-blue-400/20 bg-blue-400/[0.055] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex rounded-full border border-blue-300/25 bg-blue-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
            Bibliothèque personnalisée
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Réutiliser un modèle déjà sauvegardé
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Appliquez un modèle personnel ou partagé par l’équipe pour préremplir
            l’échéance. La date, les documents et le workflow restent propres à
            la nouvelle échéance.
          </p>

          {selectedTemplate ? (
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
              <span className="truncate">Modèle appliqué : {selectedTemplate.name}</span>
            </div>
          ) : null}
        </div>

        <Link
          href="/deadlines/library"
          className="inline-flex w-full shrink-0 justify-center rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm font-bold text-slate-100 transition hover:border-blue-300/40 hover:bg-blue-400/10 hover:text-white sm:w-auto"
        >
          Gérer la bibliothèque
        </Link>
      </div>

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-6 grid min-w-0 gap-3 lg:grid-cols-[1.2fr_0.85fr_0.85fr] xl:grid-cols-[1.3fr_0.85fr_0.85fr_0.85fr_0.85fr]">
        <div>
          <label htmlFor="templateLibrarySearch" className="sr-only">
            Rechercher un modèle
          </label>
          <input
            id="templateLibrarySearch"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            disabled={disabled || isLoadingTemplates}
            placeholder="Rechercher un modèle, une note, une checklist..."
            className="h-full min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
          disabled={disabled || isLoadingTemplates}
          className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="all">Toutes catégories</option>
          {DEADLINE_CATEGORY_OPTIONS.map((category) => (
            <option key={category.key} value={category.key}>
              {category.label}
            </option>
          ))}
        </select>

        <select
          value={visibilityFilter}
          onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}
          disabled={disabled || isLoadingTemplates}
          className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {VISIBILITY_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>

        <select
          value={importanceFilter}
          onChange={(event) => setImportanceFilter(event.target.value as ImportanceFilter)}
          disabled={disabled || isLoadingTemplates}
          className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {IMPORTANCE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>

        <select
          value={recurrenceFilter}
          onChange={(event) => setRecurrenceFilter(event.target.value as RecurrenceFilter)}
          disabled={disabled || isLoadingTemplates}
          className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {RECURRENCE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          {isLoadingTemplates
            ? "Chargement de la bibliothèque..."
            : `${filteredTemplates.length} modèle${filteredTemplates.length > 1 ? "s" : ""} affiché${filteredTemplates.length > 1 ? "s" : ""}`}
        </p>
        <button
          type="button"
          onClick={resetFilters}
          disabled={disabled || isLoadingTemplates}
          className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Réinitialiser les filtres
        </button>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredTemplates.map((template) => {
          const isSelected = String(template.id) === selectedTemplateId;
          const categoryLabel = getDeadlineCategoryDisplay({
            category: template.category,
            categoryKey: template.category_key,
            customCategoryLabel: template.custom_category_label,
          });

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelectTemplate(template)}
              disabled={disabled || isLoadingTemplates}
              className={`group flex min-h-full flex-col rounded-3xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-blue-300/60 bg-blue-500/20 shadow-lg shadow-blue-950/20"
                  : "border-white/10 bg-slate-950/35 hover:-translate-y-0.5 hover:border-blue-300/40 hover:bg-blue-400/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold text-white transition group-hover:text-blue-100">
                    {template.name}
                  </p>
                  <p className="mt-2 line-clamp-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200/80">
                    {categoryLabel}
                  </p>
                </div>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${
                    isSelected
                      ? "border-blue-200 bg-blue-300 text-slate-950"
                      : "border-white/10 bg-white/[0.04] text-slate-400 group-hover:border-blue-300/40 group-hover:text-blue-100"
                  }`}
                  aria-hidden="true"
                >
                  {isSelected ? "✓" : "+"}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                {template.description || template.title}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getVisibilityClassName(template.visibility)}`}>
                  {DEADLINE_TEMPLATE_VISIBILITY_LABELS[template.visibility]}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-200">
                  {DEADLINE_IMPORTANCE_LABELS[template.importance_level]}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-200">
                  {RECURRENCE_SHORT_LABELS[template.recurrence_rule]}
                </span>
              </div>

              <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Rappels
                  </span>
                  <span className="text-right font-semibold text-blue-100">
                    {getDeadlineTemplateReminderSummary(template.notification_days)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Checklist
                  </span>
                  <span className="text-right font-semibold text-slate-200">
                    {template.checklist_items.length} étape{template.checklist_items.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!isLoadingTemplates && filteredTemplates.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-slate-950/35 p-5 text-sm leading-6 text-slate-400">
          Aucun modèle ne correspond à ces filtres. Vous pouvez créer votre premier
          modèle depuis la page bibliothèque ou enregistrer une échéance existante
          comme modèle.
        </div>
      ) : null}
    </section>
  );
}
