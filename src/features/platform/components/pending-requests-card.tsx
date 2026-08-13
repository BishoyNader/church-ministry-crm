"use client";

import { useTranslations } from "next-intl";
import { Inbox, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SectionCard } from "@/components/layout/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { useRelativeTime } from "@/hooks/use-relative-time";
import { StaggerItem, StaggerList } from "@/components/motion/motion-primitives";
import { useChurchRequests } from "@/features/churches/hooks/use-church-requests";

const PREVIEW_LIMIT = 5;

export function PendingRequestsCard() {
  const t = useTranslations("admin.dashboard.pendingRequests");
  const relativeTime = useRelativeTime();
  const { data, isLoading } = useChurchRequests("pending");

  const rows = data?.data ?? [];
  const preview = rows.slice(0, PREVIEW_LIMIT);

  return (
    <SectionCard className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </div>
        {!isLoading && rows.length > 0 ? (
          <Badge variant="outline">{rows.length}</Badge>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<Inbox className="size-6" />} title={t("empty")} />
        </div>
      ) : (
        <StaggerList className="mt-4 flex-1 space-y-3" stagger={0.05}>
          {preview.map((request) => (
            <StaggerItem key={request.id}>
              <div className="rounded-xl border border-border-whisper bg-surface-elevated p-3">
                <p className="truncate text-sm font-medium">{request.church_name_ar}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {request.applicant_name} · {request.email}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("submitted", { date: relativeTime({ date: request.created_at }) })}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      {!isLoading && rows.length > 0 ? (
        <Link
          href="/admin/church-requests"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ministry hover:underline"
        >
          {t("reviewAll")}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </Link>
      ) : null}
    </SectionCard>
  );
}
