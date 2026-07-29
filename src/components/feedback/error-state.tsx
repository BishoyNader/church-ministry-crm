import { AlertCircle } from "lucide-react";

type ErrorStateProps = {
  title: string;
  message?: string;
};

export function ErrorState({ title, message }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/30 bg-destructive/10 px-6 py-16 text-center">
      <AlertCircle className="size-8 text-destructive" />
      <h3 className="mt-4 text-lg font-semibold text-destructive">{title}</h3>
      {message ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
