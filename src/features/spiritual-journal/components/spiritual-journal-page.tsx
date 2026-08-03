"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGuard } from "@/features/rbac";
import { useSpiritualJournalList, useDeleteSpiritualJournalEntry } from "../hooks/use-spiritual-journal";
import { SpiritualJournalFormDialog } from "@/features/spiritual-journal/components/spiritual-journal-form-dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import type { SpiritualJournalEntry } from "../types/spiritual-journal.types";

const pageSize = 20;

export function SpiritualJournalPage() {
  const t = useTranslations("spiritualJournal");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SpiritualJournalEntry | null>(null);

  const { data, isLoading, error } = useSpiritualJournalList({ page, pageSize });
  const deleteMutation = useDeleteSpiritualJournalEntry();

  const entries = data?.data?.data ?? [];
  const totalPages = data?.data?.totalPages ?? 1;

  const handleDelete = useCallback(
    (entryId: string) => {
      if (confirm(t("deleteConfirm"))) deleteMutation.mutate(entryId);
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

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <PermissionGuard permission="spiritual.create">
            <Button onClick={handleOpenCreate}>
              <Plus className="size-4" />
              {t("addEntry")}
            </Button>
          </PermissionGuard>
        }
      />

      {error ? (
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
                        {new Date(entry.entryDate).toLocaleDateString()}
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

          <div className="flex items-center justify-between border-t border-border p-4">
            <p className="text-sm text-muted-foreground">{t("pageInfo", { page, totalPages })}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                {t("prev")}
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                {t("next")}
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      <SpiritualJournalFormDialog open={dialogOpen} onOpenChange={handleDialogClose} entry={editingEntry} />
    </section>
  );
}