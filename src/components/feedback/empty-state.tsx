import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-whisper bg-card px-6 py-10 sm:py-16 text-center">
      {icon ? (
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-gold/10 p-4 text-primary shadow-diffused-sm ring-1 ring-inset ring-primary/10">
          {icon}
        </div>
      ) : null}
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
