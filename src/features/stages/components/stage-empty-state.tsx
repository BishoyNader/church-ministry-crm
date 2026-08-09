import { useTranslations } from "next-intl";
import { FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";

type StageEmptyStateProps = {
  scoped?: boolean;
};

export function StageEmptyState({ scoped = false }: StageEmptyStateProps) {
  const t = useTranslations("stages");

  return (
    <EmptyState
      icon={<FolderOpen className="size-8 text-muted-foreground" />}
      title={scoped ? t("scope.title") : t("emptyState.title")}
      description={scoped ? t("scope.viewAssignedOnly") : t("emptyState.description")}
    />
  );
}
