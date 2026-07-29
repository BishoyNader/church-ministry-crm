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
        "rounded-hero border border-whisper bg-surface-elevated p-6 shadow-diffused-md sm:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
