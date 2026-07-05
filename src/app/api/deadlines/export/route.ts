import { NextRequest, NextResponse } from "next/server";
import {
  buildDeadlineAccessOrFilter,
  DEADLINE_VISIBILITY_LABELS,
  getDeadlineWorkflowLabel,
  normalizeDeadlineVisibility,
  normalizeDeadlineWorkflowStatus,
} from "@/lib/deadline-access";
import { getDeadlineDocumentsByDeadlineId } from "@/lib/deadline-documents-server";
import { formatFileSize } from "@/lib/deadline-documents";
import { ensureUserOrganization } from "@/lib/organizations";
import { getRecurrenceShortLabel } from "@/lib/recurrence";
import { getDeadlineImportanceLabel } from "@/lib/deadline-importance";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Deadline = {
  id: number;
  title: string;
  category: string | null;
  due_date: string;
  notification_days: number[] | null;
  recurrence_rule: string | null;
  importance_level: string | null;
  created_at: string;
  user_id: string | null;
  organization_id: string | null;
  visibility: string | null;
  workflow_status: string | null;
};

type EnrichedDeadline = Deadline & {
  categoryLabel: string;
  daysUntilDeadline: number;
  formattedDate: string;
  readableStatus: string;
  priorityLabel: string;
  remindersLabel: string;
  recurrenceLabel: string;
  importanceLabel: string;
  documentFileName: string;
  documentFileSize: string;
  visibilityLabel: string;
  workflowLabel: string;
  visibility: string;
  workflowStatus: string;
};

type StatusFilter = "all" | "late" | "today" | "next7" | "next30" | "safe";
type ScopeFilter = "all" | "team" | "personal" | "in_progress" | "completed" | "history";
type SortOption = "due_asc" | "due_desc" | "title_asc" | "created_desc";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const SCOPE_FILTERS: ScopeFilter[] = ["all", "team", "personal", "in_progress", "completed", "history"];

const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "late",
  "today",
  "next7",
  "next30",
  "safe",
];
const SORT_OPTIONS: SortOption[] = [
  "due_asc",
  "due_desc",
  "title_asc",
  "created_desc",
];

function getTodayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    const fallbackDate = new Date(date);
    fallbackDate.setHours(0, 0, 0, 0);
    return fallbackDate;
  }

  return new Date(year, month - 1, day);
}

function getDaysUntilDeadline(dueDate: string, today: Date) {
  const deadlineDate = parseLocalDate(dueDate);
  return Math.ceil((deadlineDate.getTime() - today.getTime()) / DAY_IN_MS);
}

function formatDeadlineDate(dueDate: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseLocalDate(dueDate));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getReadableStatus(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) {
    const daysLate = Math.abs(daysUntilDeadline);
    return `En retard de ${daysLate} jour${daysLate > 1 ? "s" : ""}`;
  }

  if (daysUntilDeadline === 0) return "À traiter aujourd’hui";
  if (daysUntilDeadline === 1) return "À traiter demain";

  return `Dans ${daysUntilDeadline} jours`;
}

function getPriorityLabel(daysUntilDeadline: number) {
  if (daysUntilDeadline < 0) return "Action immédiate";
  if (daysUntilDeadline === 0) return "À faire aujourd’hui";
  if (daysUntilDeadline <= 7) return "Très proche";
  if (daysUntilDeadline <= 30) return "À anticiper";
  return "Sous contrôle";
}

function formatReminder(day: number) {
  if (day === 0) return "Jour J";
  return `J-${day}`;
}

function normalizeNotificationDays(days: number[] | null) {
  if (!Array.isArray(days)) return [];

  return [...new Set(days)]
    .filter((day) => Number.isInteger(day) && day >= 0)
    .sort((firstDay, secondDay) => secondDay - firstDay);
}

function getScopeFilter(value: string | null): ScopeFilter {
  return SCOPE_FILTERS.includes(value as ScopeFilter)
    ? (value as ScopeFilter)
    : "all";
}

function getStatusFilter(value: string | null): StatusFilter {
  return STATUS_FILTERS.includes(value as StatusFilter)
    ? (value as StatusFilter)
    : "all";
}

function getSortOption(value: string | null): SortOption {
  return SORT_OPTIONS.includes(value as SortOption)
    ? (value as SortOption)
    : "due_asc";
}

function matchesScopeFilter(deadline: EnrichedDeadline, scope: ScopeFilter) {
  if (scope === "history") return deadline.workflowStatus === "archived";
  if (deadline.workflowStatus === "archived") return false;
  if (scope === "team") return deadline.visibility === "team";
  if (scope === "personal") return deadline.visibility === "personal";
  if (scope === "in_progress") return deadline.workflowStatus === "in_progress";
  if (scope === "completed") return deadline.workflowStatus === "completed";
  return true;
}

function matchesStatusFilter(deadline: EnrichedDeadline, status: StatusFilter) {
  if (status === "late") return deadline.daysUntilDeadline < 0;
  if (status === "today") return deadline.daysUntilDeadline === 0;
  if (status === "next7") {
    return deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 7;
  }
  if (status === "next30") {
    return deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 30;
  }
  if (status === "safe") return deadline.daysUntilDeadline > 30;

  return true;
}

function sortDeadlines(deadlines: EnrichedDeadline[], sort: SortOption) {
  return [...deadlines].sort((firstDeadline, secondDeadline) => {
    if (sort === "due_desc") {
      return (
        parseLocalDate(secondDeadline.due_date).getTime() -
        parseLocalDate(firstDeadline.due_date).getTime()
      );
    }

    if (sort === "title_asc") {
      return firstDeadline.title.localeCompare(secondDeadline.title, "fr", {
        sensitivity: "base",
      });
    }

    if (sort === "created_desc") {
      return (
        new Date(secondDeadline.created_at).getTime() -
        new Date(firstDeadline.created_at).getTime()
      );
    }

    return (
      parseLocalDate(firstDeadline.due_date).getTime() -
      parseLocalDate(secondDeadline.due_date).getTime()
    );
  });
}

function csvCell(value: string | number | null | undefined) {
  const normalizedValue = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();
  return `"${normalizedValue.replace(/"/g, '""')}"`;
}

function buildCsv(deadlines: EnrichedDeadline[]) {
  const headers = [
    "Titre",
    "Catégorie",
    "Date d’échéance",
    "Statut",
    "Portée",
    "Suivi équipe",
    "Priorité date",
    "Importance",
    "Rappels",
    "Récurrence",
    "Document associé",
    "Nom du document",
    "Taille du document",
    "Créée le",
  ];

  const rows = deadlines.map((deadline) => [
    deadline.title,
    deadline.categoryLabel,
    deadline.formattedDate,
    deadline.readableStatus,
    deadline.visibilityLabel,
    deadline.workflowLabel,
    deadline.priorityLabel,
    deadline.importanceLabel,
    deadline.remindersLabel,
    deadline.recurrenceLabel,
    deadline.documentFileName ? "Oui" : "Non",
    deadline.documentFileName,
    deadline.documentFileSize,
    formatDateTime(deadline.created_at),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");
}

function buildExportFileName() {
  const date = new Date().toISOString().slice(0, 10);
  return `duepilot-echeances-${date}.csv`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const rawSearchQuery = searchParams.get("q") ?? "";
  const searchQuery = rawSearchQuery.trim().slice(0, 80);
  const normalizedSearchQuery = searchQuery.toLocaleLowerCase("fr-FR");
  const scopeFilter = getScopeFilter(searchParams.get("scope"));
  const statusFilter = getStatusFilter(searchParams.get("status"));
  const categoryFilter = searchParams.get("category") || "all";
  const yearFilter = (searchParams.get("year") ?? "").replace(/[^0-9]/g, "").slice(0, 4);
  const monthFilter = /^(0[1-9]|1[0-2])$/.test(searchParams.get("month") ?? "")
    ? searchParams.get("month") ?? ""
    : "";
  const sortOption = getSortOption(searchParams.get("sort"));

  const userOrganization = await ensureUserOrganization({
    userId: user.id,
    email: user.email,
  });

  const { data: deadlines, error } = await supabase
    .from("deadlines")
    .select("id, title, category, due_date, notification_days, recurrence_rule, importance_level, created_at, user_id, organization_id, visibility, workflow_status")
    .or(
      buildDeadlineAccessOrFilter({
        userId: user.id,
        organizationId: userOrganization?.organization.id,
      })
    )
    .order("due_date", { ascending: true })
    .returns<Deadline[]>();

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to export deadlines" },
      { status: 500 }
    );
  }

  const today = getTodayAtMidnight();
  const deadlineList = deadlines ?? [];
  const documentsByDeadlineId = await getDeadlineDocumentsByDeadlineId({
    supabase,
    userId: user.id,
    deadlineIds: deadlineList.map((deadline) => deadline.id),
  });

  const enrichedDeadlines: EnrichedDeadline[] = deadlineList.map((deadline) => {
    const daysUntilDeadline = getDaysUntilDeadline(deadline.due_date, today);
    const document = documentsByDeadlineId.get(deadline.id) ?? null;
    const reminders = normalizeNotificationDays(deadline.notification_days);

    const visibility = normalizeDeadlineVisibility(deadline.visibility);
    const workflowStatus = normalizeDeadlineWorkflowStatus(deadline.workflow_status);

    return {
      ...deadline,
      visibility,
      workflowStatus,
      visibilityLabel: DEADLINE_VISIBILITY_LABELS[visibility],
      workflowLabel: getDeadlineWorkflowLabel({ status: workflowStatus, visibility }),
      categoryLabel: deadline.category?.trim() || "Sans catégorie",
      daysUntilDeadline,
      formattedDate: formatDeadlineDate(deadline.due_date),
      readableStatus: getReadableStatus(daysUntilDeadline),
      priorityLabel: getPriorityLabel(daysUntilDeadline),
      remindersLabel:
        reminders.length > 0 ? reminders.map(formatReminder).join(", ") : "Aucun rappel",
      recurrenceLabel: getRecurrenceShortLabel(deadline.recurrence_rule),
      importanceLabel: getDeadlineImportanceLabel(deadline.importance_level),
      documentFileName: document?.file_name ?? "",
      documentFileSize: document ? formatFileSize(document.file_size) : "",
    };
  });

  const filteredDeadlines = sortDeadlines(
    enrichedDeadlines.filter((deadline) => {
      const searchableContent = [
        deadline.title,
        deadline.categoryLabel,
        deadline.formattedDate,
        deadline.readableStatus,
        deadline.priorityLabel,
        deadline.importanceLabel,
        deadline.remindersLabel,
        deadline.recurrenceLabel,
        deadline.documentFileName,
      ]
        .join(" ")
        .toLocaleLowerCase("fr-FR");

      const matchesSearch = normalizedSearchQuery
        ? searchableContent.includes(normalizedSearchQuery)
        : true;
      const matchesCategory =
        categoryFilter === "all" || deadline.categoryLabel === categoryFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesScopeFilter(deadline, scopeFilter) &&
        matchesStatusFilter(deadline, statusFilter)
      );
    }),
    sortOption
  );

  const csv = `\uFEFF${buildCsv(filteredDeadlines)}\r\n`;
  const fileName = buildExportFileName();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
