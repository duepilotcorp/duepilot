type DuePilotTransitionLoaderProps = {
  active?: boolean;
  message?: string;
};

export default function DuePilotTransitionLoader({
  active = true,
  message = "Préparation de votre espace sécurisé…",
}: DuePilotTransitionLoaderProps) {
  return (
    <div className={`duepilot-transition-card ${active ? "duepilot-transition-card-active" : ""}`}>
      <div className="duepilot-transition-orbit" />
      <div className="duepilot-transition-logo" aria-hidden="true">
        <svg className="h-12 w-12" viewBox="0 0 64 64" role="img">
          <defs>
            <linearGradient
              id="duepilot-transition-mark"
              x1="10"
              x2="54"
              y1="7"
              y2="58"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#00D4FF" />
              <stop offset="0.46" stopColor="#2563FF" />
              <stop offset="1" stopColor="#0A1023" />
            </linearGradient>
          </defs>
          <path
            d="M11.5 8.5h25.4c2.2 0 4.3.9 5.8 2.5l10.3 10.7c1.5 1.6 2.4 3.7 2.4 5.9v20.1c0 4.3-3.5 7.8-7.8 7.8H11.5a3 3 0 0 1-3-3v-41a3 3 0 0 1 3-3Z"
            fill="url(#duepilot-transition-mark)"
          />
          <path d="M10.5 10.5 31 31 9 51.5" fill="#020617" fillOpacity="0.34" />
          <path
            d="m17 32.5 9.2 9.1 21-23.1"
            fill="none"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="6.5"
          />
        </svg>
      </div>

      <div className="min-w-0 text-center">
        <p className="text-sm font-semibold tracking-[0.32em] text-white">DUEPILOT</p>
        <p className="mt-1 text-xs text-slate-300">{message}</p>
      </div>

      <div className="duepilot-transition-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
