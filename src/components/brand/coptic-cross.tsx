import { cn } from "@/lib/utils";

type CopticCrossProps = React.ComponentProps<"svg"> & {
  /** Size class for the icon (defaults to size-6). */
  className?: string;
};

/**
 * Stylised Coptic cross brand mark — an upright cross whose arms meet inside
 * a central ring, a form familiar from Coptic iconography and church seals.
 * Pure vector, themes via `currentColor`.
 */
export function CopticCross({ className, ...props }: CopticCrossProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-6", className)}
      {...props}
    >
      <g fill="currentColor">
        <rect x="13.5" y="4.5" width="5" height="23" rx="2.5" />
        <rect x="4.5" y="13.5" width="23" height="5" rx="2.5" />
      </g>
      <circle
        cx="16"
        cy="16"
        r="6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
    </svg>
  );
}
