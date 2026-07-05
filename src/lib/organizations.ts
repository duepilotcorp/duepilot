import { supabaseAdmin } from "@/lib/supabase/admin";

export const ORGANIZATION_MEMBER_ROLES = ["owner", "admin", "member", "viewer"] as const;

export type OrganizationMemberRole = (typeof ORGANIZATION_MEMBER_ROLES)[number];

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationMemberRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
  viewer: "Lecteur",
};

export type Organization = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
};

export type OrganizationMembership = {
  organization_id: string;
  user_id: string;
  role: OrganizationMemberRole;
  status: "active" | "invited" | "disabled";
};

export type UserOrganization = {
  organization: Organization;
  membership: OrganizationMembership;
};

function getDefaultOrganizationName(email?: string | null) {
  if (!email) return "Mon entreprise";

  const localPart = email.split("@")[0]?.trim();

  if (!localPart) return "Mon entreprise";

  return `Entreprise ${localPart}`;
}

function normalizeOrganizationName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 120);
}

function isOrganizationMemberRole(value: string | null | undefined): value is OrganizationMemberRole {
  return ORGANIZATION_MEMBER_ROLES.includes(value as OrganizationMemberRole);
}

export async function getUserOrganization(userId: string | null | undefined) {
  if (!userId) return null;

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, user_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (membershipError) {
    console.error(membershipError);
    return null;
  }

  const membership = memberships?.[0];

  if (!membership?.organization_id || !isOrganizationMemberRole(membership.role)) {
    return null;
  }

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .select("id, name, created_at, updated_at, created_by")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) {
    console.error(organizationError);
    return null;
  }

  if (!organization) return null;

  return {
    organization: organization as Organization,
    membership: {
      organization_id: membership.organization_id,
      user_id: membership.user_id,
      role: membership.role,
      status: membership.status,
    } as OrganizationMembership,
  } satisfies UserOrganization;
}

export async function ensureUserOrganization({
  userId,
  email,
}: {
  userId: string;
  email?: string | null;
}) {
  const existingOrganization = await getUserOrganization(userId);

  if (existingOrganization) {
    await backfillUserDeadlinesOrganization({
      userId,
      organizationId: existingOrganization.organization.id,
    });

    return existingOrganization;
  }

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: getDefaultOrganizationName(email),
      created_by: userId,
    })
    .select("id, name, created_at, updated_at, created_by")
    .single();

  if (organizationError || !organization) {
    console.error(organizationError);
    return null;
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: userId,
      role: "owner",
      status: "active",
    })
    .select("organization_id, user_id, role, status")
    .single();

  if (membershipError || !membership || !isOrganizationMemberRole(membership.role)) {
    console.error(membershipError);
    return null;
  }

  await backfillUserDeadlinesOrganization({
    userId,
    organizationId: organization.id,
  });

  return {
    organization: organization as Organization,
    membership: {
      organization_id: membership.organization_id,
      user_id: membership.user_id,
      role: membership.role,
      status: membership.status,
    } as OrganizationMembership,
  } satisfies UserOrganization;
}

export async function backfillUserDeadlinesOrganization({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}) {
  const { error } = await supabaseAdmin
    .from("deadlines")
    .update({ organization_id: organizationId })
    .eq("user_id", userId)
    .is("organization_id", null);

  if (error) {
    console.error(error);
  }
}

export async function updateUserOrganizationName({
  userId,
  organizationId,
  name,
}: {
  userId: string;
  organizationId: string;
  name: string;
}) {
  const normalizedName = normalizeOrganizationName(name);

  if (normalizedName.length < 2) {
    return {
      success: false,
      message: "Le nom de l’entreprise doit contenir au moins 2 caractères.",
    };
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    console.error(membershipError);
    return {
      success: false,
      message: "Impossible de vérifier vos droits sur cette entreprise.",
    };
  }

  const role = membership?.role;

  if (role !== "owner" && role !== "admin") {
    return {
      success: false,
      message: "Vous n’avez pas les droits nécessaires pour modifier cette entreprise.",
    };
  }

  const { error } = await supabaseAdmin
    .from("organizations")
    .update({
      name: normalizedName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) {
    console.error(error);
    return {
      success: false,
      message: "Impossible d’enregistrer le nom de l’entreprise pour le moment.",
    };
  }

  return {
    success: true,
    message: "Entreprise mise à jour.",
  };
}
