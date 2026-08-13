"use client";

import { useTranslations } from "next-intl";
import { Building2, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SectionCard } from "@/components/layout/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { useRelativeTime } from "@/hooks/use-relative-time";
import { StaggerItem, StaggerList } from "@/components/motion/motion-primitives";
import { useChurchList } from "@/features/churches/hooks/use-churches";
import { ChurchStatusBadge } from "@/features/churches/components/church-status-badge";

const PREVIEW_LIMIT = 5;

export function PlatformChurchesOverview() {
  const t = useTranslations("admin.dashboard.churches");
  const relativeTime = useRelativeTime();
  const { data, isLoading } = useChurchList({ pageSize: PREVIEW_LIMIT });

  const rows = data?.data?.rows ?? [];

  return (
    <SectionCard className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </div>
        <Link
          href="/admin/churches"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ministry hover:underline"
        >
          {t("viewAll")}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<Building2 className="size-6" />} title={t("empty")} />
        </div>
      ) : (
        <StaggerList className="mt-4 flex-1 divide-y" stagger={0.05}>
          {rows.map((church) => (
            <StaggerItem key={church.id}>
              <Link
                href={`/admin/churches/${church.id}`}
                className="flex items-center justify-between gap-3 rounded-lg py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium hover:underline">{church.name_ar}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {church.slug} · {relativeTime({ date: church.created_at })}
                  </p>
                </div>
                <ChurchStatusBadge status={church.status} />
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </SectionCard>
  );
}
