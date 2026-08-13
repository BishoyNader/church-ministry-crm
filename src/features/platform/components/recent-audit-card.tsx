"use client";

import { useTranslations } from "next-intl";
import { ScrollText, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SectionCard } from "@/components/layout/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { useRelativeTime } from "@/hooks/use-relative-time";
import { StaggerItem, StaggerList } from "@/components/motion/motion-primitives";
import { usePlatformRecentAudit } from "../hooks/use-platform-dashboard";

const PREVIEW_LIMIT = 8;

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
  import: "secondary",
  export: "secondary",
  login: "outline",
  logout: "outline",
  read: "outline",
  cron: "outline",
};

export function RecentAuditCard() {
  const t = useTranslations("admin.dashboard.recentAudit");
  const relativeTime = useRelativeTime();
  const { data, isLoading } = usePlatformRecentAudit(PREVIEW_LIMIT);

  const rows = data?.data ?? [];

  return (
    <SectionCard className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </div>
        <Link
          href="/audit"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ministry hover:underline"
        >
          {t("viewAll")}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<ScrollText className="size-6" />} title={t("empty")} />
        </div>
      ) : (
        <StaggerList className="mt-4 divide-y" stagger={0.04}>
          {rows.map((entry) => (
            <StaggerItem key={entry.id}>
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ACTION_VARIANT[entry.action] ?? "secondary"} className="capitalize">
                      {entry.action}
                    </Badge>
                    <span className="truncate text-xs text-muted-foreground">{entry.entityType}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.actorName ?? entry.actorEmail ?? "—"}
                    {entry.churchNameAr ? ` · ${entry.churchNameAr}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime({ date: entry.createdAt })}
                </span>
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </SectionCard>
  );
}
