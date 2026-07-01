import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  const { data, error } = await resend.emails.send({
    from: "DuePilot <onboarding@resend.dev>",
    to: "duepilotcorp@gmail.com",
    subject: "Test DuePilot",
    html: "<p>Ça fonctionne 🎉</p>",
  });

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ data });
}