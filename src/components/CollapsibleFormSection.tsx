"use client";

import { useState, type ReactNode } from "react";

type CollapsibleFormSectionProps = {
  title: string;
  description: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function CollapsibleFormSection({
  title,
  description,
  badge = "Optionnel",
  defaultOpen = false,
  children,
}: CollapsibleFormSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      className="group rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-slate-950/20 transition open:bg-white/[0.045]"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none flex-col gap-4 p-5 outline-none transition marker:hidden focus-visible:ring-4 focus-visible:ring-blue-500/10 sm:flex-row sm:items-start sm:justify-between sm:p-6 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
            {badge}
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/35 text-lg font-semibold text-slate-200 transition group-open:rotate-180">
            ↓
          </span>
        </div>
      </summary>

      <div className="border-t border-white/10 px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        {children}
      </div>
    </details>
  );
}
