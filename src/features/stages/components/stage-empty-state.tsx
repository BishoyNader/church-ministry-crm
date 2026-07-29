import { useTranslations } from "next-intl";
import { FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";

export function StageEmptyState() {
  const t = useTranslations("stages.emptyState");

  return (
    <EmptyState
      icon={<FolderOpen className="size-8 text-muted-foreground" />}
      title={t("title")}
      description={t("description")}
    />
  );
}
