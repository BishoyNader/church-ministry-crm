import { Users } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import type { ReactNode } from "react";

type ChildEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
};

export function ChildEmptyState({ icon, title, description }: ChildEmptyStateProps) {
  return (
    <EmptyState
      icon={icon ?? <Users className="size-8 text-muted-foreground" />}
      title={title}
      description={description}
    />
  );
}
