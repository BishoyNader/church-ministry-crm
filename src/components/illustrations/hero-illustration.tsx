import { cn } from "@/lib/utils";

export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 440 340"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("h-auto w-full", className)}
    >
      <defs>
        <linearGradient id="heroBg" x1="0" y1="0" x2="440" y2="340" gradientUnits="userSpaceOnUse">
          <stop className="text-primary/15" stopColor="currentColor" />
          <stop className="text-ministry/10" offset="1" stopColor="currentColor" />
        </linearGradient>
        <linearGradient id="churchRoof" x1="0" y1="0" x2="0" y2="1">
          <stop className="text-primary" stopColor="currentColor" />
          <stop className="text-primary-700" offset="1" stopColor="currentColor" />
        </linearGradient>
      </defs>

      <rect width="440" height="340" rx="28" fill="url(#heroBg)" />

      <circle cx="120" cy="70" r="14" className="text-primary/25" fill="currentColor" />
      <circle cx="330" cy="250" r="10" className="text-ministry/25" fill="currentColor" />
      <circle cx="370" cy="80" r="6" className="text-primary/20" fill="currentColor" />

      <g>
        <rect x="120" y="120" width="200" height="150" rx="14" className="text-primary/15" fill="currentColor" />
        <rect x="104" y="108" width="232" height="20" rx="10" className="text-primary/20" fill="currentColor" />
      </g>

      <g className="text-foreground">
        <path d="M180 260V188c0-5 4-9 9-9h52c5 0 9 4 9 9v72" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
        <path d="M196 260v-40c0-4 3-7 7-7h30c4 0 7 3 7 7v40" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
        <rect x="150" y="188" width="140" height="10" rx="5" fill="currentColor" />
      </g>

      <g className="text-foreground">
        <rect x="138" y="104" width="164" height="72" rx="18" className="fill-muted" />
        <path d="M192 140l14-14 26 26 14-14 20 20v8h-74z" fill="currentColor" />
        <circle cx="272" cy="124" r="8" fill="currentColor" opacity="0.85" />
      </g>

      <g className="text-primary">
        <rect x="322" y="120" width="96" height="40" rx="20" className="fill-primary/10" />
        <circle cx="340" cy="140" r="7" fill="currentColor" />
        <rect x="354" y="136" width="44" height="8" rx="4" fill="currentColor" opacity="0.6" />
      </g>

      <g className="text-ministry">
        <rect x="24" y="210" width="88" height="36" rx="18" className="fill-ministry/10" />
        <path d="M40 226l8-8 8 8 14-12v10H40z" fill="currentColor" />
        <rect x="60" y="228" width="34" height="6" rx="3" fill="currentColor" opacity="0.6" />
      </g>
    </svg>
  );
}
