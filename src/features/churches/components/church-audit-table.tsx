"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/layout/section-card";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { useChurchAudit } from "../hooks/use-churches";

const PAGE_SIZE = 10;

type ChurchAuditTableProps = {
  churchId: string;
  limit?: number;
};

export function ChurchAuditTable({ churchId, limit }: ChurchAuditTableProps) {
  const t = useTranslations("churches");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useChurchAudit(churchId, page, limit ?? PAGE_SIZE);

  const rows = data?.data?.rows ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  if (error) {
    return <div className="py-10 text-center text-destructive">{error.message}</div>;
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: limit ?? 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <SearchX className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("audit.emptyState")}</p>
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((event) => (
              <div key={event.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{event.action}</Badge>
                    <span className="text-sm font-medium">{event.entityType}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {event.actorName ?? event.actorEmail ?? "—"} · {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {!limit && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={limit ?? PAGE_SIZE}
          labelMode="count"
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
