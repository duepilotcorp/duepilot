import { randomBytes } from "crypto";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const BETA_ACCESS_STATUSES = [
  "new",
  "contacted",
  "accepted",
  "rejected",
] as const;

export type BetaAccessStatus = (typeof BETA_ACCESS_STATUSES)[number];

export const BETA_ACCESS_STATUS_LABELS: Record<BetaAccessStatus, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  accepted: "Accepté",
  rejected: "Refusé",
};

export type BetaAccessActivationRequest = {
  id: string;
  full_name: string;
  email: string;
  company: string;
  role: string;
  deadline_volume: string;
  message: string | null;
  status: BetaAccessStatus;
  internal_notes: string | null;
};

const resend = new Resend(process.env.RESEND_API_KEY);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.duepilot.fr"
  ).replace(/\/$/, "");
}

function getTemporaryPassword() {
  return `${randomBytes(24).toString("base64url")}A1!`;
}

function formatDateTimeForNote(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function appendInternalNote(currentNotes: string | null, note: string) {
  const normalizedCurrentNotes = currentNotes?.trim();
  const nextNote = `[${formatDateTimeForNote(new Date())}] ${note}`;

  return normalizedCurrentNotes
    ? `${normalizedCurrentNotes}\n\n${nextNote}`.slice(0, 1200)
    : nextNote.slice(0, 1200);
}

async function findAuthUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      console.error(error);
      return null;
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail
    );

    if (user) return user;

    if (data.users.length < 100) break;
    page += 1;
  }

  return null;
}

async function ensureBetaAuthUser(request: BetaAccessActivationRequest) {
  const normalizedEmail = normalizeEmail(request.email);
  const existingUser = await findAuthUserByEmail(normalizedEmail);

  if (existingUser) {
    return {
      success: true,
      userId: existingUser.id,
      wasCreated: false,
    };
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: getTemporaryPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: request.full_name,
      company: request.company,
      beta_access_request_id: request.id,
      source: "beta_access",
    },
  });

  if (error || !data.user) {
    console.error(error);
    return {
      success: false,
      message: "Impossible de créer le compte Supabase pour cette demande.",
    };
  }

  return {
    success: true,
    userId: data.user.id,
    wasCreated: true,
  };
}

async function generatePasswordCreationLink(email: string) {
  const redirectTo = `${getAppUrl()}/reset-password?welcome=1`;
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: normalizeEmail(email),
    options: {
      redirectTo,
    },
  });

  if (error || !data.properties?.action_link) {
    console.error(error);
    return null;
  }

  return data.properties.action_link;
}

async function sendBetaAccessEmail({
  request,
  activationUrl,
  accountWasCreated,
}: {
  request: BetaAccessActivationRequest;
  activationUrl: string;
  accountWasCreated: boolean;
}) {
  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      message: "RESEND_API_KEY n’est pas configurée.",
    };
  }

  const safeFullName = escapeHtml(request.full_name);
  const safeCompany = escapeHtml(request.company);
  const safeActivationUrl = escapeHtml(activationUrl);

  const { error } = await resend.emails.send({
    from: "DuePilot <contact@duepilot.fr>",
    to: normalizeEmail(request.email),
    subject: "Votre accès beta DuePilot est ouvert",
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 640px; margin: 0 auto;">
        <div style="padding: 28px 0 16px;">
          <p style="margin: 0 0 10px; color: #2563eb; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;">DuePilot beta privée</p>
          <h1 style="margin: 0; font-size: 28px; line-height: 1.2;">Votre accès est prêt.</h1>
        </div>

        <p>Bonjour ${safeFullName},</p>
        <p>
          Bonne nouvelle : votre demande d’accès beta DuePilot pour <strong>${safeCompany}</strong> a été acceptée.
        </p>
        <p>
          Cliquez sur le bouton ci-dessous pour créer votre mot de passe sécurisé et accéder à votre espace DuePilot.
        </p>

        <p style="margin: 30px 0;">
          <a href="${safeActivationUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 14px; font-weight: 700;">
            Créer mon mot de passe
          </a>
        </p>

        <p style="font-size: 14px; color: #475569;">
          Pour des raisons de sécurité, ce lien est temporaire. S’il expire, utilisez simplement la page “Mot de passe oublié” avec cette même adresse email.
        </p>

        <p style="font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; margin-top: 28px; padding-top: 18px;">
          ${accountWasCreated ? "Un compte DuePilot a été préparé pour cette adresse." : "Un compte existait déjà pour cette adresse : ce lien vous permet de définir ou renouveler votre mot de passe."}
        </p>
      </div>
    `,
  });

  if (error) {
    console.error(error);
    return {
      success: false,
      message: "Le compte est prêt, mais l’email d’accès n’a pas pu être envoyé.",
    };
  }

  return {
    success: true,
    message: "Email d’accès beta envoyé.",
  };
}

export function isBetaAccessStatus(value: string): value is BetaAccessStatus {
  return BETA_ACCESS_STATUSES.includes(value as BetaAccessStatus);
}

export async function activateBetaAccessRequest(request: BetaAccessActivationRequest) {
  const normalizedEmail = normalizeEmail(request.email);

  if (!isValidEmail(normalizedEmail)) {
    return {
      success: false,
      message: "L’adresse email de cette demande est invalide.",
    };
  }

  const userResult = await ensureBetaAuthUser(request);

  if (!userResult.success) {
    return {
      success: false,
      message: userResult.message ?? "Impossible de préparer le compte beta.",
    };
  }

  const accountWasCreated = Boolean("wasCreated" in userResult ? userResult.wasCreated : false);
  const activationUrl = await generatePasswordCreationLink(normalizedEmail);

  if (!activationUrl) {
    return {
      success: false,
      message: "Compte préparé, mais impossible de générer le lien sécurisé.",
    };
  }

  const emailResult = await sendBetaAccessEmail({
    request,
    activationUrl,
    accountWasCreated,
  });

  if (!emailResult.success) {
    return emailResult;
  }

  const { error } = await supabaseAdmin
    .from("beta_access_requests")
    .update({
      status: "accepted",
      internal_notes: appendInternalNote(
        request.internal_notes,
        `Accès beta envoyé à ${normalizedEmail}. Compte ${accountWasCreated ? "créé" : "existant"}.`
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (error) {
    console.error(error);
    return {
      success: false,
      message: "Email envoyé, mais impossible de mettre à jour la demande beta.",
    };
  }

  return {
    success: true,
    message: "Accès beta envoyé.",
  };
}
