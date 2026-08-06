"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/layout/section-card";
import { useChurchUsers } from "../hooks/use-churches";

const PAGE_SIZE = 10;

type ChurchUsersTableProps = {
  churchId: string;
};

export function ChurchUsersTable({ churchId }: ChurchUsersTableProps) {
  const t = useTranslations("churches");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const filters = useMemo(() => ({ page, pageSize: PAGE_SIZE, search: search || undefined }), [page, search]);

  const { data, isLoading, error } = useChurchUsers(churchId, filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const rows = data?.data?.rows ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  if (error) {
    return (
      <div className="py-10 text-center text-destructive">{error.message}</div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder={t("users.searchPlaceholder")}
        aria-label={t("users.searchPlaceholder")}
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        className="sm:max-w-xs"
      />

      <SectionCard>
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <SearchX className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("users.emptyState")}</p>
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((user) => (
              <div key={user.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{user.fullNameAr}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.email} {user.phone ? `· ${user.phone}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{user.roleTypes.join(", ") || "—"}</span>
                  <Badge variant={user.isActive ? "default" : "secondary"}>
                    {user.isActive ? t("statusActive") : t("statusInactive")}
                  </Badge>
                  <span>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("paginationLabel", { total, page, totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
