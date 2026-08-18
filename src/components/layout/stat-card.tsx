"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  isLoading?: boolean;
  className?: string;
  accent?: boolean;
  /** Semantic tone for the leading icon + value. */
  tone?: "default" | "primary" | "warning" | "success" | "danger";
};

const toneIcon: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-muted text-muted-foreground group-hover:bg-muted/80",
  primary: "bg-primary/10 text-primary group-hover:bg-primary/15",
  warning: "bg-warning/10 text-warning group-hover:bg-warning/15",
  success: "bg-success/10 text-success group-hover:bg-success/15",
  danger: "bg-danger/10 text-danger group-hover:bg-danger/15",
};

const toneValue: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  primary: "text-primary",
  warning: "text-warning",
  success: "text-success",
  danger: "text-danger",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  className,
  accent,
  tone = accent ? "primary" : "default",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group rounded-card border border-border-whisper bg-surface-elevated p-3 sm:p-4 shadow-diffused-sm transition-shadow duration-200",
        className,
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={cn(
            "rounded-xl p-2.5 sm:p-3 transition-colors duration-200",
            toneIcon[tone],
          )}
        >
          <Icon className="size-4 sm:size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {isLoading ? (
            <Skeleton className="mt-1 h-5 sm:h-7 w-16" />
          ) : (
            <p className={cn("text-lg sm:text-2xl font-bold leading-none tracking-tight tabular-nums", toneValue[tone])}>
              {value ?? "\u2014"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
