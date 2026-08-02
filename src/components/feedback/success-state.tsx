import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

type SuccessStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SuccessState({ title, description, action }: SuccessStateProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-success/30 bg-success/5 px-6 py-16 text-center"
    >
      <div className="rounded-2xl bg-success/10 p-4 text-success shadow-diffused-sm">
        <CheckCircle2 className="size-8" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
