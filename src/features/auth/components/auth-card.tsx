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
        "mx-auto w-full max-w-xl rounded-3xl border border-border-whisper bg-surface-elevated p-8 shadow-diffused-lg",
        className,
      )}
    >
      <div className="mb-8 space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
