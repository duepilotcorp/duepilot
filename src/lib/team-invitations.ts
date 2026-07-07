import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserDisplayName } from "@/lib/user-display";
import {
  ORGANIZATION_MEMBER_ROLES,
  ORGANIZATION_ROLE_LABELS,
  type OrganizationMemberRole,
} from "@/lib/organizations";

const resend = new Resend(process.env.RESEND_API_KEY);

const INVITABLE_ROLES = ["admin", "member", "viewer"] as const;
export type InvitableOrganizationRole = (typeof INVITABLE_ROLES)[number];

export type TeamMember = {
  userId: string;
  email: string;
  displayName: string;
  role: OrganizationMemberRole;
  roleLabel: string;
  status: string;
  createdAt: string | null;
};

export type TeamInvitation = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  organizationId: string;
  email: string;
  role: InvitableOrganizationRole;
  roleLabel: string;
  status: "pending" | "accepted" | "canceled" | "expired";
  token: string;
  invitedBy: string | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isInvitableRole(value: string | null | undefined): value is InvitableOrganizationRole {
  return INVITABLE_ROLES.includes(value as InvitableOrganizationRole);
}

export function getTeamInvitationRoleLabel(role: string | null | undefined) {
  if (role && role in ORGANIZATION_ROLE_LABELS) {
    return ORGANIZATION_ROLE_LABELS[role as OrganizationMemberRole];
  }

  return "Membre";
}

export function canManageOrganizationTeam(role: string | null | undefined) {
  return role === "owner" || role === "admin";
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

export async function getOrganizationMembers(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, user_id, role, status, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  const members = await Promise.all(
    (data ?? []).map(async (membership) => {
      const { data: userData, error: userError } =
        await supabaseAdmin.auth.admin.getUserById(membership.user_id);

      if (userError) {
        console.error(userError);
      }

      const role = ORGANIZATION_MEMBER_ROLES.includes(
        membership.role as OrganizationMemberRole
      )
        ? (membership.role as OrganizationMemberRole)
        : "member";

      return {
        userId: membership.user_id,
        email: userData.user?.email ?? "Email indisponible",
        displayName: getUserDisplayName(userData.user),
        role,
        roleLabel: ORGANIZATION_ROLE_LABELS[role],
        status: membership.status ?? "active",
        createdAt: membership.created_at ?? null,
      } satisfies TeamMember;
    })
  );

  return members;
}

export async function getOrganizationInvitations(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("organization_invitations")
    .select(
      "id, created_at, updated_at, organization_id, email, role, status, token, invited_by, accepted_by, accepted_at, expires_at"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []).map((invitation) => {
    const role = isInvitableRole(invitation.role) ? invitation.role : "member";

    return {
      id: invitation.id,
      createdAt: invitation.created_at,
      updatedAt: invitation.updated_at,
      organizationId: invitation.organization_id,
      email: invitation.email,
      role,
      roleLabel: getTeamInvitationRoleLabel(role),
      status: invitation.status,
      token: invitation.token,
      invitedBy: invitation.invited_by,
      acceptedBy: invitation.accepted_by,
      acceptedAt: invitation.accepted_at,
      expiresAt: invitation.expires_at,
    } satisfies TeamInvitation;
  });
}

export async function getPendingInvitationByToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("organization_invitations")
    .select(
      "id, created_at, updated_at, organization_id, email, role, status, token, invited_by, accepted_by, accepted_at, expires_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  if (!data) return null;

  const role = isInvitableRole(data.role) ? data.role : "member";

  return {
    id: data.id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    organizationId: data.organization_id,
    email: data.email,
    role,
    roleLabel: getTeamInvitationRoleLabel(role),
    status: data.status,
    token: data.token,
    invitedBy: data.invited_by,
    acceptedBy: data.accepted_by,
    acceptedAt: data.accepted_at,
    expiresAt: data.expires_at,
  } satisfies TeamInvitation;
}

async function getOrganizationName(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return "votre entreprise";
  }

  return data?.name ?? "votre entreprise";
}

async function sendTeamInvitationEmail({
  email,
  organizationName,
  invitationUrl,
  roleLabel,
}: {
  email: string;
  organizationName: string;
  invitationUrl: string;
  roleLabel: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      message: "L’envoi d’invitations est temporairement indisponible. Réessayez plus tard.",
    };
  }

  const { error } = await resend.emails.send({
    from: "DuePilot <contact@duepilot.fr>",
    to: email,
    subject: `${organizationName} vous invite sur DuePilot`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h1 style="margin: 0 0 16px; font-size: 24px;">Invitation DuePilot</h1>
        <p>Vous avez été invité à rejoindre l’espace DuePilot de <strong>${organizationName}</strong>.</p>
        <p>Rôle prévu : <strong>${roleLabel}</strong></p>
        <p style="margin: 28px 0;">
          <a href="${invitationUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 12px; font-weight: 700;">
            Accepter l’invitation
          </a>
        </p>
        <p style="color: #475569;">
          Si vous n’avez pas encore d’accès DuePilot, contactez l’équipe qui vous a invité pour activer votre compte.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error(error);
    return {
      success: false,
      message: "Invitation enregistrée, mais l’email n’a pas pu être envoyé.",
    };
  }

  return {
    success: true,
    message: "Invitation envoyée.",
  };
}

export async function inviteOrganizationMember({
  organizationId,
  invitedByUserId,
  invitedByRole,
  email,
  role,
}: {
  organizationId: string;
  invitedByUserId: string;
  invitedByRole: OrganizationMemberRole;
  email: string;
  role: string;
}) {
  if (!canManageOrganizationTeam(invitedByRole)) {
    return {
      success: false,
      message: "Vous n’avez pas les droits nécessaires pour inviter un membre.",
    };
  }

  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return {
      success: false,
      message: "Renseignez une adresse email valide.",
    };
  }

  if (!isInvitableRole(role)) {
    return {
      success: false,
      message: "Le rôle sélectionné n’est pas valide.",
    };
  }

  const existingUser = await findAuthUserByEmail(normalizedEmail);

  if (existingUser) {
    const { data: existingMembership, error: existingMembershipError } =
      await supabaseAdmin
        .from("organization_members")
        .select("user_id, status")
        .eq("organization_id", organizationId)
        .eq("user_id", existingUser.id)
        .maybeSingle();

    if (existingMembershipError) {
      console.error(existingMembershipError);
      return {
        success: false,
        message: "Impossible de vérifier les membres existants.",
      };
    }

    if (existingMembership?.status === "active") {
      return {
        success: false,
        message: "Cet utilisateur fait déjà partie de l’entreprise.",
      };
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const { data: existingInvitation, error: existingInvitationError } =
    await supabaseAdmin
      .from("organization_invitations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .maybeSingle();

  if (existingInvitationError) {
    console.error(existingInvitationError);
    return {
      success: false,
      message: "Impossible de vérifier les invitations existantes.",
    };
  }

  const invitationPayload = {
    organization_id: organizationId,
    email: normalizedEmail,
    role,
    status: "pending",
    invited_by: invitedByUserId,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  };

  const query = existingInvitation
    ? supabaseAdmin
        .from("organization_invitations")
        .update(invitationPayload)
        .eq("id", existingInvitation.id)
        .select(
          "id, created_at, updated_at, organization_id, email, role, status, token, invited_by, accepted_by, accepted_at, expires_at"
        )
        .single()
    : supabaseAdmin
        .from("organization_invitations")
        .insert(invitationPayload)
        .select(
          "id, created_at, updated_at, organization_id, email, role, status, token, invited_by, accepted_by, accepted_at, expires_at"
        )
        .single();

  const { data: invitation, error: invitationError } = await query;

  if (invitationError || !invitation) {
    console.error(invitationError);
    return {
      success: false,
      message: "Impossible d’enregistrer l’invitation pour le moment.",
    };
  }

  const organizationName = await getOrganizationName(organizationId);
  const invitationUrl = `https://www.duepilot.fr/team/invitations/${invitation.token}`;
  const emailResult = await sendTeamInvitationEmail({
    email: normalizedEmail,
    organizationName,
    invitationUrl,
    roleLabel: getTeamInvitationRoleLabel(role),
  });

  return {
    success: emailResult.success,
    message: emailResult.success
      ? "Invitation envoyée."
      : emailResult.message,
  };
}

export async function cancelOrganizationInvitation({
  organizationId,
  invitationId,
  userRole,
}: {
  organizationId: string;
  invitationId: string;
  userRole: OrganizationMemberRole;
}) {
  if (!canManageOrganizationTeam(userRole)) {
    return {
      success: false,
      message: "Vous n’avez pas les droits nécessaires pour annuler cette invitation.",
    };
  }

  const { error } = await supabaseAdmin
    .from("organization_invitations")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("organization_id", organizationId)
    .eq("status", "pending");

  if (error) {
    console.error(error);
    return {
      success: false,
      message: "Impossible d’annuler l’invitation pour le moment.",
    };
  }

  return {
    success: true,
    message: "Invitation annulée.",
  };
}

export async function acceptOrganizationInvitation({
  token,
  userId,
  userEmail,
}: {
  token: string;
  userId: string;
  userEmail: string | null | undefined;
}) {
  const invitation = await getPendingInvitationByToken(token);

  if (!invitation) {
    return {
      success: false,
      message: "Cette invitation est introuvable.",
    };
  }

  if (invitation.status !== "pending") {
    return {
      success: false,
      message: "Cette invitation n’est plus active.",
    };
  }

  if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
    await supabaseAdmin
      .from("organization_invitations")
      .update({
        status: "expired",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    return {
      success: false,
      message: "Cette invitation a expiré.",
    };
  }

  if (normalizeEmail(userEmail ?? "") !== invitation.email) {
    return {
      success: false,
      message:
        "Vous devez être connecté avec l’adresse email invitée pour accepter cette invitation.",
    };
  }

  const { error: membershipError } = await supabaseAdmin
    .from("organization_members")
    .upsert(
      {
        organization_id: invitation.organizationId,
        user_id: userId,
        role: invitation.role,
        status: "active",
      },
      {
        onConflict: "organization_id,user_id",
      }
    );

  if (membershipError) {
    console.error(membershipError);
    return {
      success: false,
      message: "Impossible de vous rattacher à cette entreprise.",
    };
  }

  const { error: invitationError } = await supabaseAdmin
    .from("organization_invitations")
    .update({
      status: "accepted",
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  if (invitationError) {
    console.error(invitationError);
  }

  return {
    success: true,
    message: "Invitation acceptée.",
    organizationId: invitation.organizationId,
  };
}

export async function updateOrganizationMemberRole({
  organizationId,
  actingUserId,
  actingUserRole,
  targetUserId,
  newRole,
}: {
  organizationId: string;
  actingUserId: string;
  actingUserRole: OrganizationMemberRole;
  targetUserId: string;
  newRole: string;
}) {
  if (!canManageOrganizationTeam(actingUserRole)) {
    return {
      success: false,
      message: "Vous n’avez pas les droits nécessaires pour modifier les rôles.",
    };
  }

  if (actingUserId === targetUserId) {
    return {
      success: false,
      message: "Vous ne pouvez pas modifier votre propre rôle.",
    };
  }

  if (!isInvitableRole(newRole)) {
    return {
      success: false,
      message: "Le rôle sélectionné n’est pas valide.",
    };
  }

  const { data: targetMembership, error: targetError } = await supabaseAdmin
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .eq("status", "active")
    .maybeSingle();

  if (targetError) {
    console.error(targetError);
    return {
      success: false,
      message: "Impossible de vérifier ce membre pour le moment.",
    };
  }

  if (!targetMembership) {
    return {
      success: false,
      message: "Ce membre actif est introuvable.",
    };
  }

  if (targetMembership.role === "owner") {
    return {
      success: false,
      message: "Le propriétaire de l’organisation ne peut pas être modifié.",
    };
  }

  if (actingUserRole !== "owner" && targetMembership.role === "admin") {
    return {
      success: false,
      message: "Seul le propriétaire peut modifier un administrateur.",
    };
  }

  const { error } = await supabaseAdmin
    .from("organization_members")
    .update({
      role: newRole,
    })
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .eq("status", "active");

  if (error) {
    console.error(error);
    return {
      success: false,
      message: "Impossible de modifier ce rôle pour le moment.",
    };
  }

  return {
    success: true,
    message: "Rôle mis à jour.",
  };
}

export async function disableOrganizationMember({
  organizationId,
  actingUserId,
  actingUserRole,
  targetUserId,
}: {
  organizationId: string;
  actingUserId: string;
  actingUserRole: OrganizationMemberRole;
  targetUserId: string;
}) {
  if (!canManageOrganizationTeam(actingUserRole)) {
    return {
      success: false,
      message: "Vous n’avez pas les droits nécessaires pour supprimer un membre.",
    };
  }

  if (actingUserId === targetUserId) {
    return {
      success: false,
      message: "Vous ne pouvez pas supprimer votre propre accès.",
    };
  }

  const { data: targetMembership, error: targetError } = await supabaseAdmin
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .eq("status", "active")
    .maybeSingle();

  if (targetError) {
    console.error(targetError);
    return {
      success: false,
      message: "Impossible de vérifier ce membre pour le moment.",
    };
  }

  if (!targetMembership) {
    return {
      success: false,
      message: "Ce membre actif est introuvable.",
    };
  }

  if (targetMembership.role === "owner") {
    return {
      success: false,
      message: "Le propriétaire de l’organisation ne peut pas être supprimé.",
    };
  }

  if (actingUserRole !== "owner" && targetMembership.role === "admin") {
    return {
      success: false,
      message: "Seul le propriétaire peut supprimer un administrateur.",
    };
  }

  const { count: activeManagersCount, error: managersError } = await supabaseAdmin
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("role", ["owner", "admin"]);

  if (managersError) {
    console.error(managersError);
    return {
      success: false,
      message: "Impossible de vérifier les administrateurs restants.",
    };
  }

  if ((activeManagersCount ?? 0) <= 1 && targetMembership.role === "admin") {
    return {
      success: false,
      message: "Impossible de retirer le dernier administrateur actif.",
    };
  }

  const { error } = await supabaseAdmin
    .from("organization_members")
    .update({
      status: "disabled",
    })
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .eq("status", "active");

  if (error) {
    console.error(error);
    return {
      success: false,
      message: "Impossible de supprimer ce membre pour le moment.",
    };
  }

  return {
    success: true,
    message: "Membre retiré de l’organisation.",
  };
}
