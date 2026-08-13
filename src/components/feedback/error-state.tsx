import { AlertCircle } from "lucide-react";

type ErrorStateProps = {
  title: string;
  message?: string;
};

export function ErrorState({ title, message }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 px-6 py-16 text-center"
    >
      <div className="rounded-2xl bg-destructive/10 p-4 text-destructive ring-1 ring-inset ring-destructive/10">
        <AlertCircle className="size-8" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-destructive">{title}</h3>
      {message ? (
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
