import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") return "";

  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function getFallbackDisplayName(email: string | null | undefined) {
  const localPart = email?.split("@")[0]?.trim();

  if (!localPart) return "Compte DuePilot";

  return localPart;
}

export function getDisplayNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  email?: string | null
) {
  const fullName = normalizeDisplayName(metadata?.full_name);
  const name = normalizeDisplayName(metadata?.name);

  return fullName || name || getFallbackDisplayName(email);
}

export function getUserDisplayName(user: User | null | undefined) {
  if (!user) return "Compte DuePilot";

  return getDisplayNameFromMetadata(
    user.user_metadata as Record<string, unknown> | null | undefined,
    user.email
  );
}

export async function getAuthUserDisplayName(userId: string | null | undefined) {
  if (!userId) return null;

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    console.warn(error);
    return null;
  }

  return getUserDisplayName(data.user);
}

export async function getAuthUserDisplayNameMap(userIds: Array<string | null | undefined>) {
  const uniqueUserIds = Array.from(
    new Set(userIds.filter((userId): userId is string => Boolean(userId)))
  );

  const entries = await Promise.all(
    uniqueUserIds.map(async (userId) => [userId, await getAuthUserDisplayName(userId)] as const)
  );

  return new Map(entries.filter(([, displayName]) => Boolean(displayName)) as [string, string][]);
}
