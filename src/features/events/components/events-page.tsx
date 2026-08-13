"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { CalendarDays, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { ErrorState } from "@/components/feedback/error-state";
import { PermissionGuard } from "@/features/rbac";
import { formatLocalizedDateTime } from "@/lib/dates";
import { useEventList, useEventOptions } from "../hooks/use-events";
import { EventFormDialog } from "./event-form-dialog";
import { EventDeleteDialog } from "./event-delete-dialog";
import type { EventListItem, EventTypeFilter } from "../types/events.types";

const PAGE_SIZE = 20;

type EventsPageProps = {
  presetServiceId?: string;
};

export function EventsPage({ presetServiceId }: EventsPageProps) {
  const t = useTranslations("events");
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>("all");
  const [serviceId, setServiceId] = useState<string | undefined>(presetServiceId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventListItem | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<EventListItem | null>(null);

  const optionsQuery = useEventOptions();
  const services = optionsQuery.data?.data?.services ?? [];

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      eventType: eventTypeFilter,
      serviceId,
    }),
    [page, search, eventTypeFilter, serviceId],
  );

  const { data, isLoading, error } = useEventList(filters);

  const rows = data?.data?.rows ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 0;

  const hasActiveFilters = search || eventTypeFilter !== "all" || !!serviceId;

  const clearFilters = () => {
    setSearchInput("");
    setEventTypeFilter("all");
    setServiceId(undefined);
    setPage(1);
  };

  if (error) {
    return <ErrorState title={t("errors.listFailed")} message={error.message} />;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <PermissionGuard permission="events.create">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("addEvent")}
            </Button>
          </PermissionGuard>
        }
      />

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <Input
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="flex-1 min-w-[200px]"
          />

          <Select value={eventTypeFilter} onValueChange={(value) => { setEventTypeFilter(value as EventTypeFilter); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("filters.allTypes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allTypes")}</SelectItem>
              <SelectItem value="meeting">{t("form.eventTypes.meeting")}</SelectItem>
              <SelectItem value="camp">{t("form.eventTypes.camp")}</SelectItem>
              <SelectItem value="conference">{t("form.eventTypes.conference")}</SelectItem>
              <SelectItem value="trip">{t("form.eventTypes.trip")}</SelectItem>
              <SelectItem value="other">{t("form.eventTypes.other")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={serviceId ?? "all"} onValueChange={(value) => { setServiceId(value === "all" ? undefined : (value as string)); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder={t("filters.allServices")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allServices")}</SelectItem>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <RotateCcw className="size-4" />
              {t("filters.clearFilters")}
            </Button>
          )}
        </div>
      </SectionCard>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <SectionCard className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="rounded-2xl bg-muted p-4 text-muted-foreground">
            <CalendarDays className="size-8" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-tight">{t("empty.title")}</h3>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {t("empty.description")}
          </p>
        </SectionCard>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("table.caption")}</caption>
              <thead>
                <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3">{t("table.title")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.type")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.service")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.date")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.status")}</th>
                  <th scope="col" className="px-4 py-3 text-end">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((event) => (
                  <tr key={event.id} className="align-middle">
                    <td className="px-4 py-3">
                      <p className="font-medium">{event.title_ar}</p>
                      {event.title_en ? (
                        <p className="text-xs text-muted-foreground">{event.title_en}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{t(`form.eventTypes.${event.event_type}`)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.serviceNameAr ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatLocalizedDateTime(event.start_at, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={event.is_active ? "default" : "secondary"}>
                        {event.is_active ? t("status.active") : t("status.inactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <PermissionGuard permission="events.update">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("table.edit")}
                            onClick={() => setEditEvent(event)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="events.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("table.delete")}
                            onClick={() => setDeleteEvent(event)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
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
    </section>
  );
}
