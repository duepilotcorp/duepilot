import { supabaseAdmin } from "@/lib/supabase/admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function getDaysUntilDueDate(dueDate: string) {
  const today = new Date();
  const deadlineDate = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);

  return Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
const secret = searchParams.get("secret");

if (secret !== process.env.CRON_SECRET) {
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

const { error: emailError } = await resend.emails.send({
  from: "DuePilot <onboarding@resend.dev>",
  to: "duepilotcorp@gmail.com",
  subject: `Rappel échéance : ${deadline.title}`,
  html: `
    <h2>Rappel d'échéance</h2>

    <p>
      Votre échéance <strong>${deadline.title}</strong>
      arrive dans <strong>${daysUntilDueDate} jour(s)</strong>.
    </p>

    <p>
      Catégorie : ${deadline.category}
    </p>

    <p>
      Date d'échéance : ${deadline.due_date}
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