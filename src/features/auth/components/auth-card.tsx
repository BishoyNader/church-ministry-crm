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
    <div className={cn("mx-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/80 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/20", className)}>
      <div className="mb-8 space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
        {description ? <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
