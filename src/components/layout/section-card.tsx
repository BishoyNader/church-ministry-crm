import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SectionCardProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated";
};

export function SectionCard({ children, className, variant = "default" }: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-whisper bg-surface-elevated shadow-diffused-sm",
        variant === "elevated" && "shadow-diffused-md",
        className,
      )}
    >
      {children}
    </div>
  );
}
