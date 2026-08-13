"use client";

import { useTranslations, useLocale } from "next-intl";
import { UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/layout/section-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { useRelativeTime } from "@/hooks/use-relative-time";
import Link from "next/link";
import type { RecentChildItem } from "../types/dashboard.types";

type RecentChildrenProps = {
  data?: RecentChildItem[];
  isLoading: boolean;
};

export function RecentChildren({ data, isLoading }: RecentChildrenProps) {
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
        <UserRound className="size-4 text-muted-foreground" />
        {t("recentChildren.title")}
      </h3>
      {!data || data.length === 0 ? (
        <EmptyState
          icon={<UserRound className="size-6 text-muted-foreground" />}
          title={t("noData")}
        />
      ) : (
        <ul className="space-y-2">
          {data.map((child) => (
            <li key={child.id}>
              <Link
                href={`/${locale}/children/${child.id}`}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 text-sm transition hover:border-primary/30 hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{child.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {relativeTime({ date: child.createdAt })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

