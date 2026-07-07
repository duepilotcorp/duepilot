export default function Loading() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-3 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:rounded-[1.75rem]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-2xl border border-blue-300/20 bg-blue-400/10" />
              <div>
                <div className="h-3 w-28 animate-pulse rounded-full bg-blue-100/20" />
                <div className="mt-2 hidden h-2 w-36 animate-pulse rounded-full bg-white/10 sm:block" />
              </div>
            </div>
            <div className="grid gap-2 min-[380px]:grid-cols-2 sm:flex sm:justify-end">
              <div className="h-10 animate-pulse rounded-2xl bg-white/[0.06] sm:w-28" />
              <div className="h-10 animate-pulse rounded-2xl bg-white/[0.06] sm:w-36" />
              <div className="h-10 animate-pulse rounded-2xl bg-white/[0.06] sm:w-44" />
            </div>
          </div>
        </div>

        <section className="premium-sheen mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/20 backdrop-blur">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
              <div>
                <div className="h-7 w-40 animate-pulse rounded-full border border-blue-400/15 bg-blue-400/10" />
                <div className="mt-6 h-12 max-w-2xl animate-pulse rounded-2xl bg-white/10 sm:h-16" />
                <div className="mt-4 h-5 max-w-xl animate-pulse rounded-full bg-white/[0.08]" />
                <div className="mt-3 h-5 max-w-md animate-pulse rounded-full bg-white/[0.06]" />
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
                <div className="mt-5 h-10 w-24 animate-pulse rounded-2xl bg-white/10" />
                <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-white/[0.08]" />
                <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-white/[0.06]" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {["late", "today", "month", "safe"].map((item) => (
            <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-slate-950/20">
              <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
              <div className="mt-5 h-11 w-16 animate-pulse rounded-2xl bg-white/10" />
              <div className="mt-4 h-3 w-32 animate-pulse rounded-full bg-white/[0.06]" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
