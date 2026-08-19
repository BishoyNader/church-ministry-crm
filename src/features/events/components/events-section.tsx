"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGuard } from "@/features/rbac";
import { useEventList } from "../hooks/use-events";
import { EventFormDialog } from "./event-form-dialog";
import { EventDeleteDialog } from "./event-delete-dialog";
import type { EventListItem } from "../types/events.types";

function formatShortDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

type EventsSectionProps = {
  serviceId: string;
};

export function EventsSection({ serviceId }: EventsSectionProps) {
  const t = useTranslations("events.section");
  const tForm = useTranslations("events.form");
  const locale = useLocale();

  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventListItem | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<EventListItem | null>(null);

  const { data, isLoading, error } = useEventList({
    serviceId,
    page: 1,
    pageSize: 10,
  });

  const rows = data?.data?.rows ?? [];

  return (
    <div className="border-t">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {t("title")}
        </h4>
        <PermissionGuard permission="events.create">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCreateOpen(true)}
            aria-label={t("addEvent")}
          >
            <Plus className="size-3.5" />
            {t("addEvent")}
          </Button>
        </PermissionGuard>
      </div>

      {isLoading ? (
        <div className="space-y-2 px-4 pb-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <p className="px-4 pb-4 text-sm text-destructive">{error.message}</p>
      ) : rows.length === 0 ? (
        <p className="px-4 pb-4 text-center text-sm text-muted-foreground">
          {t("noEvents")}
        </p>
      ) : (
        <ul className="divide-y divide-border pb-2">
          {rows.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between gap-3 px-4 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{event.title_ar}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {formatShortDate(event.start_at, locale)}
                  </p>
                  <Badge variant="secondary" className="text-[10px]">
                    {tForm(`eventTypes.${event.event_type}`)}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <PermissionGuard permission="events.update">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("edit")}
                    onClick={() => setEditEvent(event)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </PermissionGuard>
                <PermissionGuard permission="events.delete">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("delete")}
                    onClick={() => setDeleteEvent(event)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </PermissionGuard>
              </div>
            </li>
          ))}
        </ul>
      )}

      {createOpen && (
        <EventFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          presetServiceId={serviceId}
        />
      )}

      {editEvent && (
        <EventFormDialog
          open={!!editEvent}
          onOpenChange={(open) => {
            if (!open) setEditEvent(null);
          }}
          event={editEvent}
        />
      )}

      {deleteEvent && (
        <EventDeleteDialog
          open={!!deleteEvent}
          onOpenChange={(open) => {
            if (!open) setDeleteEvent(null);
          }}
          event={deleteEvent}
        />
      )}
    </div>
  );
}
