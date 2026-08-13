import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-xl rounded-3xl border border-border-whisper bg-surface-elevated p-6 shadow-diffused-lg sm:p-8",
        className,
      )}
    >
      <div className="mb-6 text-center sm:mb-8">
        <span className="mx-auto mb-4 block h-px w-10 bg-gold/60" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
