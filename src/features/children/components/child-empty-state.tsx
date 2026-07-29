"use client";

import { Baby } from "lucide-react";
import type { ReactNode } from "react";

type ChildEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
};

export function ChildEmptyState({
  icon,
  title,
  description,
}: ChildEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <div className="rounded-2xl bg-muted p-4">
        {icon ?? <Baby className="size-8 text-muted-foreground" />}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
