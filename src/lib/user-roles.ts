import { supabaseAdmin } from "@/lib/supabase/admin";

export const USER_ROLES = ["admin", "owner", "member", "viewer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  owner: "Propriétaire",
  member: "Membre",
  viewer: "Lecteur",
};

export function isUserRole(value: string | null | undefined): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export async function getUserRole(userId: string | null | undefined) {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  if (!isUserRole(data?.role)) {
    return null;
  }

  return data.role;
}

export async function isUserAdmin(userId: string | null | undefined) {
  const role = await getUserRole(userId);

  return role === "admin";
}
