import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type DashboardHeroProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function DashboardHero({ title, description, action, className }: DashboardHeroProps) {
  return (
    <div
      className={cn(
        "rounded-hero border border-border-whisper bg-surface-elevated p-4 shadow-diffused-md sm:p-6 lg:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex-shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
