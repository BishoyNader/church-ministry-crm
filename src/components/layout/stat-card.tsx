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
};

export function StatCard({ label, value, icon: Icon, isLoading, className, accent }: StatCardProps) {
  return (
    <div
      className={cn(
        "group rounded-card border border-whisper bg-surface-elevated p-4 shadow-diffused-sm transition-all duration-200 hover:shadow-diffused-md hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "rounded-xl p-3 transition-colors duration-200",
            accent
              ? "bg-ministry/10 text-ministry group-hover:bg-ministry/15"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-2xl font-bold tabular-nums">{value ?? "\u2014"}</p>
          )}
        </div>
      </div>
    </div>
  );
}
