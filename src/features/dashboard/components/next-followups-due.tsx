"use client";

import { useTranslations, useLocale } from "next-intl";
import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/layout/section-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { useRelativeTime } from "@/hooks/use-relative-time";
import Link from "next/link";
import type { ScheduledFollowupItem } from "../types/dashboard.types";

type NextFollowupsDueProps = {
  data?: ScheduledFollowupItem[];
  isLoading: boolean;
};

export function NextFollowupsDue({ data, isLoading }: NextFollowupsDueProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const relativeTime = useRelativeTime();

  if (isLoading) {
    return (
      <SectionCard className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard className="p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Phone className="size-4 text-muted-foreground" />
        {t("nextFollowupsDue.title")}
      </h3>
      {!data || data.length === 0 ? (
        <EmptyState
          icon={<Phone className="size-6 text-muted-foreground" />}
          title={t("noData")}
        />
      ) : (
        <ul className="space-y-2">
          {data.map((item) => (
            <li key={item.id}>
              <Link
                href={`/${locale}/children/${item.childId}`}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 text-sm transition hover:border-primary/30 hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.childName || "\u2014"}</p>
                  <p className="text-xs text-muted-foreground">
                    {relativeTime({ date: item.scheduledAt, future: true })}
                  </p>
                </div>
                <Badge
                  variant={item.status === "in_progress" ? "default" : "secondary"}
                  className="ml-3 shrink-0 text-xs"
                >
                  {t(`status.${item.status}`)}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
