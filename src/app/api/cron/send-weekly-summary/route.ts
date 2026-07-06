import { Resend } from "resend";
import { getDeadlineCategoryDisplay } from "@/lib/deadline-categories";
import { getDeadlineImportanceLabel } from "@/lib/deadline-importance";
import {
  normalizeDeadlineVisibility,
  normalizeDeadlineWorkflowStatus,
} from "@/lib/deadline-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.duepilot.fr";
const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WeeklySummaryDeadline = {
  id: number;
  title: string;
  category: string | null;
  category_key?: string | null;
  custom_category_label?: string | null;
  due_date: string;
  user_id: string | null;
  organization_id: string | null;
  visibility: string | null;
  workflow_status: string | null;
  importance_level: string | null;
};

type SummaryGroups = {
  overdue: WeeklySummaryDeadline[];
  next7Days: WeeklySummaryDeadline[];
  next30Days: WeeklySummaryDeadline[];
  pendingValidation: WeeklySummaryDeadline[];
  critical: WeeklySummaryDeadline[];
};

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
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

function getTodayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDaysUntilDueDate(dueDate: string, today: Date) {
  const deadlineDate = parseLocalDate(dueDate);
  deadlineDate.setHours(0, 0, 0, 0);

  return Math.ceil((deadlineDate.getTime() - today.getTime()) / DAY_IN_MS);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parseLocalDate(date));
}

function formatWeekStart(date: Date) {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(monday.getDate()).padStart(2, "0");

  return `${year}-${month}-${dayOfMonth}`;
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getReadableDeadlineDistance(deadline: WeeklySummaryDeadline, today: Date) {
  const daysUntilDueDate = getDaysUntilDueDate(deadline.due_date, today);

  if (daysUntilDueDate < 0) {
    const daysLate = Math.abs(daysUntilDueDate);
    return `en retard de ${daysLate} jour${daysLate > 1 ? "s" : ""}`;
  }

  if (daysUntilDueDate === 0) return "aujourd’hui";
  if (daysUntilDueDate === 1) return "demain";

  return `dans ${daysUntilDueDate} jours`;
}

function getDeadlineUrl(deadlineId: number) {
  return `${APP_URL}/deadlines/${deadlineId}`;
}

function buildDeadlineAccessFilter({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId?: string | null;
}) {
  if (organizationId) {
    return `user_id.eq.${userId},and(visibility.eq.team,organization_id.eq.${organizationId})`;
  }

  return `user_id.eq.${userId}`;
}

function sortByDueDate(a: WeeklySummaryDeadline, b: WeeklySummaryDeadline) {
  return parseLocalDate(a.due_date).getTime() - parseLocalDate(b.due_date).getTime();
}

function getUniqueDeadlines(deadlines: WeeklySummaryDeadline[]) {
  const seen = new Set<number>();
  const uniqueDeadlines: WeeklySummaryDeadline[] = [];

  for (const deadline of deadlines) {
    if (seen.has(deadline.id)) continue;
    seen.add(deadline.id);
    uniqueDeadlines.push(deadline);
  }

  return uniqueDeadlines;
}

function buildSummaryGroups(deadlines: WeeklySummaryDeadline[], today: Date): SummaryGroups {
  const activeDeadlines = deadlines
    .filter((deadline) => normalizeDeadlineWorkflowStatus(deadline.workflow_status) !== "archived")
    .sort(sortByDueDate);

  const overdue = activeDeadlines.filter(
    (deadline) => getDaysUntilDueDate(deadline.due_date, today) < 0
  );
  const next7Days = activeDeadlines.filter((deadline) => {
    const daysUntilDueDate = getDaysUntilDueDate(deadline.due_date, today);
    return daysUntilDueDate >= 0 && daysUntilDueDate <= 7;
  });
  const next30Days = activeDeadlines.filter((deadline) => {
    const daysUntilDueDate = getDaysUntilDueDate(deadline.due_date, today);
    return daysUntilDueDate > 7 && daysUntilDueDate <= 30;
  });
  const pendingValidation = activeDeadlines.filter(
    (deadline) =>
      normalizeDeadlineVisibility(deadline.visibility) === "team" &&
      normalizeDeadlineWorkflowStatus(deadline.workflow_status) === "completed"
  );
  const critical = activeDeadlines.filter(
    (deadline) => deadline.importance_level === "critical"
  );

  return {
    overdue,
    next7Days,
    next30Days,
    pendingValidation,
    critical,
  };
}

function renderDeadlineList({
  title,
  description,
  deadlines,
  today,
  emptyLabel,
  maxItems = 6,
}: {
  title: string;
  description: string;
  deadlines: WeeklySummaryDeadline[];
  today: Date;
  emptyLabel: string;
  maxItems?: number;
}) {
  const visibleDeadlines = getUniqueDeadlines(deadlines).slice(0, maxItems);
  const hiddenCount = Math.max(deadlines.length - visibleDeadlines.length, 0);

  if (visibleDeadlines.length === 0) {
    return `
      <section style="margin-top: 24px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 18px; background: #f8fafc;">
        <h3 style="margin: 0; color: #0f172a; font-size: 18px;">${escapeHtml(title)}</h3>
        <p style="margin: 8px 0 0; color: #64748b; line-height: 1.6;">${escapeHtml(emptyLabel)}</p>
      </section>
    `;
  }

  const items = visibleDeadlines
    .map((deadline) => {
      const safeTitle = escapeHtml(deadline.title);
      const safeCategory = escapeHtml(
        getDeadlineCategoryDisplay({
          category: deadline.category ?? "Autre",
          categoryKey: deadline.category_key,
          customCategoryLabel: deadline.custom_category_label,
        })
      );
      const safeDueDate = escapeHtml(formatDate(deadline.due_date));
      const safeDistance = escapeHtml(getReadableDeadlineDistance(deadline, today));
      const safeImportance = escapeHtml(
        getDeadlineImportanceLabel(deadline.importance_level)
      );
      const visibility = normalizeDeadlineVisibility(deadline.visibility);
      const safeVisibility = visibility === "team" ? "Équipe" : "Personnel";

      return `
        <li style="margin: 0; padding: 14px 0; border-top: 1px solid #e2e8f0; list-style: none;">
          <p style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 700;">
            <a href="${getDeadlineUrl(deadline.id)}" style="color: #2563eb; text-decoration: none;">${safeTitle}</a>
          </p>
          <p style="margin: 7px 0 0; color: #475569; font-size: 13px; line-height: 1.55;">
            ${safeCategory} · ${safeDueDate} · ${safeDistance} · ${safeImportance} · ${safeVisibility}
          </p>
        </li>
      `;
    })
    .join("");

  return `
    <section style="margin-top: 24px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 18px; background: #ffffff;">
      <h3 style="margin: 0; color: #0f172a; font-size: 18px;">${escapeHtml(title)}</h3>
      <p style="margin: 8px 0 0; color: #64748b; line-height: 1.6;">${escapeHtml(description)}</p>
      <ul style="margin: 14px 0 0; padding: 0;">
        ${items}
      </ul>
      ${
        hiddenCount > 0
          ? `<p style="margin: 12px 0 0; color: #64748b; font-size: 13px;">+ ${hiddenCount} autre${hiddenCount > 1 ? "s" : ""} échéance${hiddenCount > 1 ? "s" : ""} à consulter dans DuePilot.</p>`
          : ""
      }
    </section>
  `;
}

function renderWeeklySummaryEmail({
  displayName,
  organizationName,
  groups,
  activeCount,
  today,
}: {
  displayName: string;
  organizationName: string;
  groups: SummaryGroups;
  activeCount: number;
  today: Date;
}) {
  const safeDisplayName = escapeHtml(displayName);
  const safeOrganizationName = escapeHtml(organizationName);

  return `
    <div style="margin: 0; padding: 0; background: #f1f5f9; font-family: Arial, sans-serif; color: #0f172a;">
      <div style="max-width: 680px; margin: 0 auto; padding: 28px 16px;">
        <div style="padding: 24px; border-radius: 24px; background: #020617; color: #ffffff;">
          <p style="margin: 0; color: #93c5fd; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;">
            Résumé hebdomadaire DuePilot
          </p>
          <h1 style="margin: 14px 0 0; font-size: 28px; line-height: 1.15;">
            Bonjour ${safeDisplayName}, voici le point conformité de la semaine.
          </h1>
          <p style="margin: 14px 0 0; color: #cbd5e1; line-height: 1.7;">
            Organisation : <strong style="color: #ffffff;">${safeOrganizationName}</strong>
          </p>
        </div>

        <div style="margin-top: 20px; display: block; padding: 20px; border-radius: 20px; background: #ffffff; border: 1px solid #e2e8f0;">
          <p style="margin: 0; color: #475569; line-height: 1.7;">
            DuePilot surveille actuellement <strong>${activeCount}</strong> échéance${activeCount > 1 ? "s" : ""} active${activeCount > 1 ? "s" : ""} dans votre périmètre.
          </p>
          <div style="margin-top: 16px; display: grid; gap: 10px;">
            <p style="margin: 0; color: #0f172a;"><strong>${groups.overdue.length}</strong> en retard</p>
            <p style="margin: 0; color: #0f172a;"><strong>${groups.next7Days.length}</strong> à traiter sous 7 jours</p>
            <p style="margin: 0; color: #0f172a;"><strong>${groups.pendingValidation.length}</strong> validation${groups.pendingValidation.length > 1 ? "s" : ""} équipe en attente</p>
            <p style="margin: 0; color: #0f172a;"><strong>${groups.critical.length}</strong> très urgente${groups.critical.length > 1 ? "s" : ""}</p>
          </div>
        </div>

        ${renderDeadlineList({
          title: "Échéances en retard",
          description: "À traiter en priorité pour réduire le risque administratif.",
          deadlines: groups.overdue,
          today,
          emptyLabel: "Aucune échéance en retard cette semaine.",
        })}

        ${renderDeadlineList({
          title: "À traiter sous 7 jours",
          description: "Les prochaines échéances qui demandent une attention rapide.",
          deadlines: groups.next7Days,
          today,
          emptyLabel: "Aucune échéance prévue sous 7 jours.",
        })}

        ${renderDeadlineList({
          title: "Validations équipe en attente",
          description: "Les échéances marquées comme faites par l’équipe et à valider par un admin.",
          deadlines: groups.pendingValidation,
          today,
          emptyLabel: "Aucune validation équipe en attente.",
        })}

        ${renderDeadlineList({
          title: "À surveiller sous 30 jours",
          description: "Les échéances importantes à anticiper avant qu’elles ne deviennent urgentes.",
          deadlines: groups.next30Days,
          today,
          emptyLabel: "Aucune échéance supplémentaire sous 30 jours.",
        })}

        <div style="margin-top: 24px; padding: 20px; border-radius: 18px; background: #dbeafe; border: 1px solid #bfdbfe;">
          <p style="margin: 0; color: #1e3a8a; line-height: 1.7;">
            Vous recevez ce résumé car l’option <strong>Résumé hebdomadaire</strong> est activée dans votre espace DuePilot. Vous pouvez la désactiver à tout moment depuis <strong>Mon compte → Préférences e-mail</strong>.
          </p>
        </div>

        <p style="margin: 24px 0 0; color: #64748b; line-height: 1.7; font-size: 13px;">
          Équipe DuePilot<br />
          <a href="${APP_URL}/settings/account" style="color: #2563eb; text-decoration: none;">Gérer mes préférences e-mail</a>
        </p>
      </div>
    </div>
  `;
}

async function getUserOrganizationInfo(userId: string) {
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error(membershipError);
    return {
      organizationId: null,
      organizationName: "Mon entreprise",
    };
  }

  if (!membership?.organization_id) {
    return {
      organizationId: null,
      organizationName: "Mon entreprise",
    };
  }

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .select("id, name")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) {
    console.error(organizationError);
  }

  return {
    organizationId: membership.organization_id as string,
    organizationName: organization?.name ?? "Mon entreprise",
  };
}

async function getAccessibleDeadlines({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("deadlines")
    .select("id, title, category, category_key, custom_category_label, due_date, user_id, organization_id, visibility, workflow_status, importance_level")
    .or(buildDeadlineAccessFilter({ userId, organizationId }))
    .order("due_date", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []) as WeeklySummaryDeadline[];
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("CRON_SECRET is not configured.");

    return Response.json(
      { error: "Cron is not configured correctly." },
      { status: 500 }
    );
  }

  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const isDryRun = requestUrl.searchParams.get("dryRun") === "1";

  if (!isDryRun && !process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured.");

    return Response.json(
      { error: "Email provider is not configured correctly." },
      { status: 500 }
    );
  }

  const today = getTodayAtMidnight();
  const weekStart = formatWeekStart(today);

  const { data: preferences, error: preferencesError } = await supabaseAdmin
    .from("user_notification_preferences")
    .select("user_id")
    .eq("weekly_summary_enabled", true);

  if (preferencesError) {
    return Response.json({ error: preferencesError.message }, { status: 500 });
  }

  const results = [];

  for (const preference of preferences ?? []) {
    const userId = preference.user_id as string | null;

    if (!userId) continue;

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    const email = userData.user?.email;

    if (userError || !email) {
      results.push({ userId, status: "skipped", reason: "missing_email" });
      continue;
    }

    const { organizationId, organizationName } = await getUserOrganizationInfo(userId);
    const deadlines = await getAccessibleDeadlines({ userId, organizationId });
    const groups = buildSummaryGroups(deadlines, today);
    const activeCount = deadlines.filter(
      (deadline) => normalizeDeadlineWorkflowStatus(deadline.workflow_status) !== "archived"
    ).length;

    if (isDryRun) {
      results.push({
        userId,
        email,
        status: "dry_run",
        organizationName,
        activeCount,
        overdueCount: groups.overdue.length,
        next7DaysCount: groups.next7Days.length,
        next30DaysCount: groups.next30Days.length,
        pendingValidationCount: groups.pendingValidation.length,
        criticalCount: groups.critical.length,
      });
      continue;
    }

    const { data: logReservation, error: logReservationError } = await supabaseAdmin
      .from("weekly_summary_logs")
      .insert({
        user_id: userId,
        week_start: weekStart,
        email,
        status: "pending",
      })
      .select("id")
      .single();

    if (logReservationError) {
      if (logReservationError.code === "23505") {
        results.push({ userId, email, status: "skipped", reason: "already_sent_or_reserved" });
        continue;
      }

      console.error(logReservationError);
      results.push({ userId, email, status: "failed", reason: "log_reservation_failed" });
      continue;
    }

    const displayName =
      typeof userData.user.user_metadata?.full_name === "string" &&
      userData.user.user_metadata.full_name.trim()
        ? userData.user.user_metadata.full_name.trim()
        : email.split("@")[0] ?? "Bonjour";

    const { error: emailError } = await resend.emails.send({
      from: "DuePilot <notifications@duepilot.fr>",
      to: email,
      subject: "Résumé hebdomadaire DuePilot",
      html: renderWeeklySummaryEmail({
        displayName,
        organizationName,
        groups,
        activeCount,
        today,
      }),
    });

    if (emailError) {
      console.error(emailError);

      await supabaseAdmin
        .from("weekly_summary_logs")
        .update({
          status: "failed",
          error_message: JSON.stringify(emailError).slice(0, 500),
        })
        .eq("id", logReservation.id);

      results.push({ userId, email, status: "failed", reason: "email_failed" });
      continue;
    }

    await supabaseAdmin
      .from("weekly_summary_logs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        metadata: {
          active_count: activeCount,
          overdue_count: groups.overdue.length,
          next_7_days_count: groups.next7Days.length,
          next_30_days_count: groups.next30Days.length,
          pending_validation_count: groups.pendingValidation.length,
          critical_count: groups.critical.length,
        },
      })
      .eq("id", logReservation.id);

    results.push({
      userId,
      email,
      status: "sent",
      activeCount,
      overdueCount: groups.overdue.length,
      next7DaysCount: groups.next7Days.length,
      pendingValidationCount: groups.pendingValidation.length,
    });
  }

  return Response.json({
    success: true,
    dryRun: isDryRun,
    weekStart,
    optInUsers: preferences?.length ?? 0,
    sent: results.filter((result) => result.status === "sent").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    checked: results.filter((result) => result.status === "dry_run").length,
    results,
  });
}
