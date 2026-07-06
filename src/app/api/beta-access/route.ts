import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

const ACCESS_REQUEST_RECIPIENT = "duepilotcorp@gmail.com";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured.");

    return Response.json(
      { error: "Le service de demande d’accès n’est pas configuré." },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "La demande envoyée est invalide." },
      { status: 400 }
    );
  }

  const website = sanitizeText(body.website, 120);

  if (website) {
    return Response.json({ success: true });
  }

  const fullName = sanitizeText(body.fullName, 120);
  const email = sanitizeText(body.email, 160).toLowerCase();
  const company = sanitizeText(body.company, 140);
  const role = sanitizeText(body.role, 120);
  const deadlineVolume = sanitizeText(body.deadlineVolume, 80);
  const message = sanitizeText(body.message, 800);

  if (!fullName || !email || !company || !role || !deadlineVolume) {
    return Response.json(
      { error: "Complétez les champs obligatoires pour envoyer la demande." },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return Response.json(
      { error: "L’adresse email renseignée ne semble pas valide." },
      { status: 400 }
    );
  }

  const { error: insertError } = await supabaseAdmin
    .from("beta_access_requests")
    .insert({
      full_name: fullName,
      email,
      company,
      role,
      deadline_volume: deadlineVolume,
      message: message || null,
      status: "new",
    });

  if (insertError) {
    console.error(insertError);

    return Response.json(
      { error: "Impossible d’enregistrer la demande pour le moment." },
      { status: 500 }
    );
  }

  const safeFullName = escapeHtml(fullName);
  const safeEmail = escapeHtml(email);
  const safeCompany = escapeHtml(company);
  const safeRole = escapeHtml(role);
  const safeDeadlineVolume = escapeHtml(deadlineVolume);
  const safeMessage = escapeHtml(message || "Aucun message complémentaire.");

  const { error } = await resend.emails.send({
    from: "DuePilot <contact@duepilot.fr>",
    to: ACCESS_REQUEST_RECIPIENT,
    subject: `Nouvelle demande d’accès beta DuePilot — ${company}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h1 style="margin: 0 0 16px; font-size: 24px;">Nouvelle demande d’accès beta</h1>

        <p>Une entreprise souhaite rejoindre la beta privée DuePilot.</p>

        <table style="border-collapse: collapse; width: 100%; max-width: 640px; margin-top: 24px;">
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 12px; font-weight: 700;">Nom</td>
            <td style="border: 1px solid #e2e8f0; padding: 12px;">${safeFullName}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 12px; font-weight: 700;">Email</td>
            <td style="border: 1px solid #e2e8f0; padding: 12px;">${safeEmail}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 12px; font-weight: 700;">Entreprise</td>
            <td style="border: 1px solid #e2e8f0; padding: 12px;">${safeCompany}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 12px; font-weight: 700;">Rôle</td>
            <td style="border: 1px solid #e2e8f0; padding: 12px;">${safeRole}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 12px; font-weight: 700;">Volume estimé</td>
            <td style="border: 1px solid #e2e8f0; padding: 12px;">${safeDeadlineVolume}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 12px; font-weight: 700;">Message</td>
            <td style="border: 1px solid #e2e8f0; padding: 12px;">${safeMessage}</td>
          </tr>
        </table>

        <p style="margin-top: 24px; color: #475569;">
          Pour ouvrir l’accès, rendez-vous dans Administration → Demandes beta, passez la demande en “Accepté” et validez. DuePilot créera le compte et enverra automatiquement le lien de création du mot de passe.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error(error);

    return Response.json(
      { error: "Impossible d’envoyer la demande pour le moment." },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
