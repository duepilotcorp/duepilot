import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

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

function getDaysUntilDueDate(dueDate: string) {
  const today = new Date();
  const deadlineDate = parseLocalDate(dueDate);

  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);

  return Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getNotificationLabel(daysUntilDueDate: number) {
  if (daysUntilDueDate === 0) {
    return "aujourd’hui";
  }

  if (daysUntilDueDate === 1) {
    return "demain";
  }

  return `dans ${daysUntilDueDate} jours`;
}

function getNotificationSubjectPrefix(daysUntilDueDate: number) {
  if (daysUntilDueDate === 0) {
    return "Échéance aujourd’hui";
  }

  if (daysUntilDueDate === 1) {
    return "Échéance demain";
  }

  return `Échéance J-${daysUntilDueDate}`;
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

  const { data: deadlines, error } = await supabaseAdmin
    .from("deadlines")
    .select("id, title, category, due_date, user_id, notification_days")
    .order("due_date", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const deadlinesToNotify = [];

  for (const deadline of deadlines) {
    const daysUntilDueDate = getDaysUntilDueDate(deadline.due_date);
    const notificationDays = deadline.notification_days ?? [30, 7, 1];

    if (!notificationDays.includes(daysUntilDueDate)) {
      continue;
    }

    const { data: existingLog } = await supabaseAdmin
      .from("notification_logs")
      .select("id")
      .eq("deadline_id", deadline.id)
      .eq("user_id", deadline.user_id)
      .eq("notification_day", daysUntilDueDate)
      .eq("due_date", deadline.due_date)
      .maybeSingle();

    if (existingLog) {
      continue;
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(deadline.user_id);

    if (userError || !userData.user?.email) {
      continue;
    }

    const email = userData.user.email;
    const safeTitle = escapeHtml(deadline.title);
    const safeCategory = escapeHtml(deadline.category);
    const safeDueDate = escapeHtml(deadline.due_date);
    const safeNotificationLabel = escapeHtml(
      getNotificationLabel(daysUntilDueDate)
    );

    const { error: emailError } = await resend.emails.send({
      from: "DuePilot <onboarding@resend.dev>",
      // Resend est encore en mode test : remettre `email` dès que le domaine est validé.
      to: "duepilotcorp@gmail.com",
      subject: `${getNotificationSubjectPrefix(daysUntilDueDate)} : ${deadline.title}`,
      html: `
        <h2>Rappel d'échéance</h2>

        <p>
          Votre échéance <strong>${safeTitle}</strong>
          arrive <strong>${safeNotificationLabel}</strong>.
        </p>

        <p>
          Catégorie : ${safeCategory}
        </p>

        <p>
          Date d'échéance : ${safeDueDate}
        </p>

        <br>

        <p>
          Équipe DuePilot
        </p>
      `,
    });

    if (emailError) {
      console.error(emailError);
      continue;
    }

    await supabaseAdmin.from("notification_logs").insert({
      deadline_id: deadline.id,
      user_id: deadline.user_id,
      notification_day: daysUntilDueDate,
      due_date: deadline.due_date,
    });

    deadlinesToNotify.push({
      ...deadline,
      notification_day: daysUntilDueDate,
      email,
    });
  }

  return Response.json({
    success: true,
    totalDeadlines: deadlines.length,
    notificationsToSend: deadlinesToNotify.length,
    deadlinesToNotify,
  });
}
