"use client";

import { useMemo, useState } from "react";
import { getActivityLogTone, type ActivityLog } from "@/lib/activity-logs";

type ActivityLogListProps = {
  logs: ActivityLog[];
  initialVisibleCount?: number;
};

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function ActivityLogList({
  logs,
  initialVisibleCount = 4,
}: ActivityLogListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasMoreLogs = logs.length > initialVisibleCount;
  const visibleLogs = useMemo(
    () => (isExpanded ? logs : logs.slice(0, initialVisibleCount)),
    [initialVisibleCount, isExpanded, logs]
  );

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-semibold text-white">
          Aucun événement enregistré pour le moment.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Les prochaines créations, modifications, documents et notifications
          apparaîtront automatiquement ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleLogs.map((log) => (
        <div
          key={log.id}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition duration-200 hover:border-white/15 hover:bg-white/[0.05]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-slate-100">{log.title}</p>
              {log.description ? (
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {log.description}
                </p>
              ) : null}
            </div>

            <span
              className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${getActivityLogTone(log.action)}`}
            >
              {formatDateTime(log.created_at)}
            </span>
          </div>
        </div>
      ))}

      {hasMoreLogs ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
          className="mt-2 inline-flex w-full justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        >
          {isExpanded
            ? "Réduire aux dernières activités"
            : `Voir toute l’activité (${logs.length})`}
        </button>
      ) : null}
    </div>
  );
}
