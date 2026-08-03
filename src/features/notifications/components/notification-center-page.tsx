"use client";

import { useMemo, useState } from "react";
import { BellRing, CheckCheck, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
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
  const [selectedType, setSelectedType] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useNotifications({ page, pageSize, type: selectedType });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const filters = useMemo(() => buildNotificationFilterOptions(), []);

  const notifications = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <section className="space-y-6">
      <PageHeader title="Notifications" description="Review and act on your latest alerts." />

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
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by type" />
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
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        </div>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error.message}</div>
        ) : notifications.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<BellRing className="size-6 text-muted-foreground" />}
              title="No notifications"
              description="Your inbox is clear for the selected filter."
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
                        <CircleDot className="size-4 text-primary" />
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.body_ar}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.sent_at).toLocaleString()}
                    </p>
                  </div>

                  {!notification.is_read ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markReadMutation.mutate(notification.id)}
                      disabled={markReadMutation.isPending}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border p-4">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </SectionCard>
    </section>
  );
}
