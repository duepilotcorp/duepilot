import Link from "next/link";

type AdminNavigationProps = {
  active: "overview" | "beta" | "cron";
};

const items = [
  {
    href: "/admin",
    label: "Vue d’ensemble",
    description: "Pilotage admin",
    active: "overview",
  },
  {
    href: "/admin/beta-requests",
    label: "Demandes beta",
    description: "Accès & invitations",
    active: "beta",
  },
  {
    href: "/admin/cron",
    label: "Cron & emails",
    description: "Suivi production",
    active: "cron",
  },
] as const;

export default function AdminNavigation({ active }: AdminNavigationProps) {
  return (
    <nav
      aria-label="Navigation administration"
      className="mt-6 grid gap-3 rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-2 shadow-2xl shadow-slate-950/20 backdrop-blur sm:grid-cols-3"
    >
      {items.map((item) => {
        const isActive = active === item.active;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-[1.25rem] border px-4 py-3 transition focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${
              isActive
                ? "border-blue-400/30 bg-blue-500/15 text-white shadow-lg shadow-blue-950/20"
                : "border-transparent bg-white/[0.025] text-slate-300 hover:-translate-y-0.5 hover:border-blue-400/25 hover:bg-blue-400/10 hover:text-white"
            }`}
          >
            <span className="block text-sm font-bold">{item.label}</span>
            <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}
