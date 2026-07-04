"use client";

import { useMemo, useState } from "react";
import {
  DEADLINE_TEMPLATE_SECTORS,
  DEADLINE_TEMPLATES,
  getTemplateSectorLabel,
  type DeadlineTemplate,
} from "@/lib/deadline-templates";

const INITIAL_SECTOR_ID = "btp";

function getReminderSummary(days: number[]) {
  return days
    .map((day) => {
      if (day === 0) return "Jour J";
      return `J-${day}`;
    })
    .join(" · ");
}

type DeadlineTemplatePickerProps = {
  selectedTemplateId?: string | null;
  disabled?: boolean;
  onSelectTemplate: (template: DeadlineTemplate) => void;
};

export default function DeadlineTemplatePicker({
  selectedTemplateId = null,
  disabled = false,
  onSelectTemplate,
}: DeadlineTemplatePickerProps) {
  const [activeSectorId, setActiveSectorId] = useState(INITIAL_SECTOR_ID);
  const [searchQuery, setSearchQuery] = useState("");

  const activeSector = DEADLINE_TEMPLATE_SECTORS.find(
    (sector) => sector.id === activeSectorId
  );

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return DEADLINE_TEMPLATES.filter((template) => {
      const matchesSector = template.sectorId === activeSectorId;

      if (!normalizedSearch) return matchesSector;

      const searchableContent = [
        template.title,
        template.category,
        template.description,
        template.riskLabel,
        getTemplateSectorLabel(template.sectorId),
      ]
        .join(" ")
        .toLowerCase();

      return matchesSector && searchableContent.includes(normalizedSearch);
    });
  }, [activeSectorId, searchQuery]);

  return (
    <section
      id="template-library"
      className="rounded-3xl border border-blue-400/20 bg-blue-400/[0.07] p-5 shadow-2xl shadow-slate-950/20 sm:p-6"
    >
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-blue-300/25 bg-blue-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
            Bibliothèque beta
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Ajouter depuis un modèle
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Sélectionnez un secteur puis appliquez une échéance type. DuePilot
            préremplit le nom, la catégorie et les rappels recommandés. Il ne
            vous reste qu’à choisir la vraie date.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 lg:w-72">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Logique V1
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Les modèles accélèrent la saisie sans créer de données automatiques
            ni complexité inutile côté Supabase.
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {DEADLINE_TEMPLATE_SECTORS.map((sector) => {
          const isSelected = sector.id === activeSectorId;

          return (
            <button
              key={sector.id}
              type="button"
              onClick={() => setActiveSectorId(sector.id)}
              disabled={disabled}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-blue-300/60 bg-blue-400/20 text-blue-50 shadow-lg shadow-blue-950/20"
                  : "border-white/10 bg-slate-950/35 text-slate-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {sector.shortLabel}
            </button>
          );
        })}
      </div>

      {activeSector ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/25 p-4">
          <p className="text-sm font-bold text-white">{activeSector.label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {activeSector.description}
          </p>
        </div>
      ) : null}

      <div className="mt-5">
        <label htmlFor="templateSearch" className="sr-only">
          Rechercher un modèle
        </label>
        <input
          id="templateSearch"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          disabled={disabled}
          placeholder="Rechercher dans ce secteur..."
          className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredTemplates.map((template) => {
          const isSelected = template.id === selectedTemplateId;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelectTemplate(template)}
              disabled={disabled}
              className={`group flex min-h-full flex-col rounded-3xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-blue-300/60 bg-blue-500/20 shadow-lg shadow-blue-950/20"
                  : "border-white/10 bg-slate-950/35 hover:border-blue-300/40 hover:bg-blue-400/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white transition group-hover:text-blue-100">
                    {template.title}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200/80">
                    {template.category}
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

              <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">
                {template.description}
              </p>

              <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Risque
                  </span>
                  <span className="text-right font-semibold text-slate-200">
                    {template.riskLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Rappels
                  </span>
                  <span className="text-right font-semibold text-blue-100">
                    {getReminderSummary(template.recommendedNotificationDays)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/35 p-5 text-sm leading-6 text-slate-400">
          Aucun modèle ne correspond à cette recherche dans le secteur sélectionné.
        </div>
      ) : null}
    </section>
  );
}
