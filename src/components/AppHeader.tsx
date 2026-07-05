import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import type { OrganizationMemberRole } from "@/lib/organizations";

type AppHeaderProps = {
  subtitle?: string;
  userName: string;
  userEmail?: string | null;
  organizationName?: string | null;
  organizationRole?: OrganizationMemberRole | null;
  isAdminUser?: boolean;
  active?: "dashboard" | "deadlines" | "history" | "new" | "account" | "organization" | "admin";
  exportHref?: string;
};

const baseButtonClassName =
  "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-blue-500/10";

function getNavClassName(isActive: boolean) {
  return isActive
    ? `${baseButtonClassName} border border-blue-400/30 bg-blue-500 text-white shadow-lg shadow-blue-950/30`
    : `${baseButtonClassName} border border-white/10 bg-white/[0.035] text-slate-200 hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white`;
}

function canManageOrganization(role: OrganizationMemberRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export default function AppHeader({
  subtitle = "Espace de suivi",
  userName,
  userEmail,
  organizationName,
  organizationRole,
  isAdminUser = false,
  active,
  exportHref,
}: AppHeaderProps) {
  const organizationLabel = canManageOrganization(organizationRole)
    ? "Organisation"
    : "Mon équipe";
  const showDeadlinesLink = active !== "deadlines";

  return (
    <header className="relative z-50 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-3 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/dashboard" className="group flex w-fit items-center gap-3 px-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-300/25 bg-blue-400/10 shadow-[0_0_40px_rgba(59,130,246,0.18)] transition group-hover:border-blue-200/40 group-hover:bg-blue-400/15">
            <span className="h-4 w-4 rounded-full bg-blue-300 shadow-[0_0_24px_rgba(147,197,253,0.85)]" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-[0.28em] text-blue-100">
              DUEPILOT
            </span>
            <span className="hidden text-xs text-slate-500 sm:block">
              {subtitle}
            </span>
          </span>
        </Link>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between lg:justify-end">
          <nav className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end" aria-label="Navigation principale">
            {showDeadlinesLink ? (
              <Link href="/deadlines" className={getNavClassName(false)}>
                Échéances
              </Link>
            ) : null}
            <Link href="/deadlines/new" className={getNavClassName(active === "new")}>
              Nouvelle échéance
            </Link>
            {exportHref ? (
              <a
                href={exportHref}
                className={`${baseButtonClassName} col-span-2 border border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-emerald-400/15 hover:text-white sm:col-span-1`}
              >
                Export CSV
              </a>
            ) : null}
          </nav>

          <details className="group relative z-[70]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left text-sm transition hover:border-blue-400/40 hover:bg-blue-400/10 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/10 text-sm font-bold text-blue-100">
                  {userName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-white sm:max-w-[12rem]">
                    {userName}
                  </span>
                  <span className="hidden truncate text-xs text-slate-500 sm:block sm:max-w-[14rem]">
                    {organizationName || userEmail || "Compte DuePilot"}
                  </span>
                </span>
              </span>
              <span className="text-slate-500 transition group-open:rotate-180">⌄</span>
            </summary>

            <div className="absolute right-0 z-[100] mt-3 w-full min-w-[18rem] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl md:w-80">
              <div className="border-b border-white/10 px-3 py-3">
                <p className="truncate text-sm font-bold text-white">{userName}</p>
                {userEmail ? (
                  <p className="mt-1 truncate text-xs text-slate-500">{userEmail}</p>
                ) : null}
              </div>

              <div className="grid gap-1 py-2">
                <Link
                  href="/dashboard"
                  className="rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings/account"
                  className="rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Mon compte
                </Link>
                <Link
                  href="/settings/organization"
                  className="rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.05] hover:text-white"
                >
                  {organizationLabel}
                </Link>
                <Link
                  href="/deadlines/history"
                  className={`rounded-2xl px-3 py-2.5 text-sm font-semibold transition hover:bg-white/[0.05] hover:text-white ${
                    active === "history" ? "bg-white/[0.06] text-white" : "text-slate-200"
                  }`}
                >
                  Historique des échéances
                </Link>
                {isAdminUser ? (
                  <Link
                    href="/admin/beta-requests"
                    className="rounded-2xl px-3 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-purple-400/10 hover:text-white"
                  >
                    Admin beta
                  </Link>
                ) : null}
              </div>

              <div className="border-t border-white/10 p-2">
                <LogoutButton />
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
