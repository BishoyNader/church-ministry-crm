"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type CopticPatternProps = React.ComponentProps<"svg"> & {
  /** Opacity applied to the whole pattern (default 1 — pair with text-primary/10 etc.) */
  className?: string;
};

/**
 * Subtle repeating Coptic-inspired geometric pattern (central rings + small
 * crosses + diamond accents). Rendered as vector so it stays crisp, cheap and
 * theme-aware via `currentColor`. Use at low opacity behind heroes/auth panels.
 */
export function CopticPattern({ className, ...props }: CopticPatternProps) {
  const id = useId();

  return (
    <svg
      width="100%"
      height="100%"
      aria-hidden="true"
      className={cn("h-full w-full", className)}
      {...props}
    >
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <g stroke="currentColor" fill="none" strokeWidth="1">
            <circle cx="28" cy="28" r="10" strokeOpacity="0.55" />
            <path d="M28 18v4.5m0 11v4.5M18 28h4.5m11 0H38" strokeOpacity="0.55" />
            <circle cx="3" cy="3" r="2.4" strokeOpacity="0.45" />
            <circle cx="53" cy="3" r="2.4" strokeOpacity="0.45" />
            <circle cx="3" cy="53" r="2.4" strokeOpacity="0.45" />
            <circle cx="53" cy="53" r="2.4" strokeOpacity="0.45" />
            <path
              d="M28 13.5l3.2 3.2-3.2 3.2-3.2-3.2z"
              fill="currentColor"
              fillOpacity="0.28"
              stroke="none"
            />
            <path
              d="M28 39l3.2 3.2-3.2 3.2-3.2-3.2z"
              fill="currentColor"
              fillOpacity="0.28"
              stroke="none"
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
