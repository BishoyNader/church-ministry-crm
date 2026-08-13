"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BellRing, CheckCheck, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { formatLocalizedDateTime } from "@/lib/dates";
import {
  buildNotificationFilterOptions,
  formatNotificationType,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../hooks/use-notifications";
import type { NotificationFilter } from "../types/notification.types";

const pageSize = 10;

export function NotificationCenterPage() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const [selectedType, setSelectedType] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useNotifications({ page, pageSize, type: selectedType });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const filters = useMemo(() => buildNotificationFilterOptions(), []);

  const notifications = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleMarkRead = (notificationId: string) => {
    markReadMutation.mutate(notificationId, {
      onError: () => {
        // Error is surfaced via mutation error state below
      },
    });
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate(undefined, {
      onError: () => {
        // Error is surfaced via mutation error state below
      },
    });
  };

  const mutationError = markReadMutation.error?.message ?? markAllReadMutation.error?.message ?? null;

  return (
    <section className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {mutationError ? (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {mutationError}
        </div>
      ) : null}

      <SectionCard className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedType}
              onValueChange={(value) => {
                setSelectedType(value as NotificationFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[220px]" aria-label={t("filterByType")}>
                <SelectValue placeholder={t("filterByType")} />
              </SelectTrigger>
              <SelectContent>
                {filters.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
            aria-busy={markAllReadMutation.isPending}
          >
            <CheckCheck className="size-4" />
            {t("markAllRead")}
          </Button>
        </div>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        {isLoading ? (
          <div role="status" aria-live="polite" className="space-y-3 p-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <span className="sr-only">{t("loadError")}</span>
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState title={t("loadError")} message={error.message} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<BellRing className="size-6 text-muted-foreground" />}
              title={t("noNotifications")}
              description={t("noNotificationsDescription")}
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <article key={notification.id} className="p-4 sm:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{notification.title_ar}</h3>
                      <Badge variant={notification.is_read ? "secondary" : "default"}>
                        {formatNotificationType(notification.notification_type)}
                      </Badge>
                      {!notification.is_read ? (
                        <CircleDot className="size-4 text-primary" aria-hidden="true" />
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.body_ar}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatLocalizedDateTime(notification.sent_at, locale)}
                    </p>
                  </div>

                  {!notification.is_read ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkRead(notification.id)}
                      disabled={markReadMutation.isPending}
                      aria-busy={markReadMutation.isPending}
                    >
                      {t("markRead")}
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="border-t border-border">
          <PaginationBar
            page={page}
            totalPages={totalPages}
            labelMode="page"
            onPageChange={setPage}
          />
        </div>
      </SectionCard>
    </section>
  );
}