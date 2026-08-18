"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Plus, Pencil, Trash2, BookOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLocalizedDate } from "@/lib/dates";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PermissionGuard, useAccessState, PERMISSION_CODES } from "@/features/rbac";
import { useSpiritualJournalList, useDeleteSpiritualJournalEntry } from "../hooks/use-spiritual-journal";
import { SpiritualJournalFormDialog } from "@/features/spiritual-journal/components/spiritual-journal-form-dialog";
import { SpiritualJournalOverview } from "./spiritual-journal-overview";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import type { SpiritualJournalEntry } from "../types/spiritual-journal.types";

const pageSize = 20;

export function SpiritualJournalPage() {
  const t = useTranslations("spiritualJournal");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SpiritualJournalEntry | null>(null);
  const [view, setView] = useState<"mine" | "overview">("mine");

  const { data: accessState } = useAccessState();
  const roles = accessState?.roles ?? [];
  const permissionSet = new Set(
    (accessState?.permissions ?? []).map((permission) => permission.code),
  );
  // Church-wide journal monitoring: Church Manager / Admin always; a Stage
  // Manager may use the (scoped) overview only when their role actually holds
  // spiritual.read. Everyone else gets the own-journal view.
  const isChurchViewer =
    roles.some((role) => role.role_type === "super_admin" || role.role_type === "admin") ||
    (roles.some((role) => role.role_type === "stage_manager") &&
      permissionSet.has(PERMISSION_CODES.SPIRITUAL_READ));

  const { data, isLoading, error } = useSpiritualJournalList({ page, pageSize });
  const deleteMutation = useDeleteSpiritualJournalEntry();

  const entries = data?.data?.data ?? [];
  const totalPages = data?.data?.totalPages ?? 1;

  const handleDelete = useCallback(
    (entryId: string) => {
      if (confirm(t("deleteConfirm"))) {
        deleteMutation.mutate(entryId, {
          onError: () => {
            // Error is surfaced via deleteMutation.error state below
          },
        });
      }
    },
    [deleteMutation, t],
  );

  const handleOpenCreate = useCallback(() => {
    setEditingEntry(null);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((entry: SpiritualJournalEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingEntry(null);
  }, []);

  const deleteError = deleteMutation.error?.message ?? null;

  return (
    <section className="space-y-6">
      {deleteError ? (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {deleteError}
        </div>
      ) : null}

      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {isChurchViewer ? (
              <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(view === "mine" && "bg-background shadow-sm")}
                  onClick={() => setView("mine")}
                >
                  <BookOpen className="size-4" />
                  <span className="hidden sm:inline">{t("viewMine")}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(view === "overview" && "bg-background shadow-sm")}
                  onClick={() => setView("overview")}
                >
                  <Users className="size-4" />
                  <span className="hidden sm:inline">{t("viewOverview")}</span>
                </Button>
              </div>
            ) : null}

            {view === "mine" ? (
              <PermissionGuard permission="spiritual.create">
                <Button onClick={handleOpenCreate}>
                  <Plus className="size-4" />
                  {t("addEntry")}
                </Button>
              </PermissionGuard>
            ) : null}
          </div>
        }
      />

      {view === "overview" && isChurchViewer ? (
        <SpiritualJournalOverview onBack={() => setView("mine")} />
      ) : error ? (
        <ErrorState title={t("loadError")} message={error.message} />
      ) : isLoading ? (
        <SectionCard>
          <div className="space-y-3 p-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </SectionCard>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-6 text-muted-foreground" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <SectionCard className="overflow-hidden">
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <article key={entry.id} className="p-4 sm:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">
                        {formatLocalizedDate(entry.entryDate, locale)}
                      </h3>
                      <Badge variant={entry.prayerCompleted ? "default" : "secondary"}>
                        {t("prayerCompleted")}
                      </Badge>
                      <Badge variant={entry.bibleReading ? "default" : "secondary"}>
                        {t("bibleReading")}
                      </Badge>
                      <Badge variant={entry.liturgyAttendance ? "default" : "secondary"}>
                        {t("liturgyAttendance")}
                      </Badge>
                      <Badge variant={entry.confession ? "default" : "secondary"}>
                        {t("confession")}
                      </Badge>
                    </div>
                    {entry.spiritualNotes ? (
                      <p className="text-sm text-muted-foreground">{entry.spiritualNotes}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1">
                    <PermissionGuard permission="spiritual.create">
                      <Button variant="ghost" size="icon-sm" aria-label={t("edit")} onClick={() => handleOpenEdit(entry)}>
                        <Pencil className="size-4" />
                      </Button>
                    </PermissionGuard>
                    <PermissionGuard permission="spiritual.create">
                      <Button variant="ghost" size="icon-sm" aria-label={t("delete")} onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </PermissionGuard>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="border-t border-border">
            <PaginationBar
              page={page}
              totalPages={totalPages}
              labelMode="page"
              onPageChange={setPage}
            />
          </div>
        </SectionCard>
      )}

      <SpiritualJournalFormDialog open={dialogOpen} onOpenChange={handleDialogClose} entry={editingEntry} />
    </section>
  );
}