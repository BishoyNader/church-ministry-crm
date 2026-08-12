"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/layout/section-card";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  useChurchJournalServants,
  useServantJournalEntries,
} from "../hooks/use-spiritual-journal";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string): { fromDate: string; toDate: string } {
  const [year, monthIndex] = month.split("-").map(Number);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return {
    fromDate: `${month}-01`,
    toDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

type SpiritualJournalOverviewProps = {
  onBack: () => void;
};

export function SpiritualJournalOverview({
  onBack,
}: SpiritualJournalOverviewProps) {
  const t = useTranslations("spiritualJournal.overview");
  const [servantId, setServantId] = useState<string>("");
  const [month, setMonth] = useState<string>(currentMonth());

  const servantsQuery = useChurchJournalServants();
  const servants = servantsQuery.data?.data ?? [];

  const effectiveServantId = servantId || servants[0]?.id || "";
  const { fromDate, toDate } = useMemo(() => monthRange(month), [month]);

  const entriesQuery = useServantJournalEntries(effectiveServantId, {
    pageSize: 100,
    fromDate,
    toDate,
  });

  const entries = entriesQuery.data?.data?.data ?? [];
  const selectedServant = servants.find((servant) => servant.id === effectiveServantId);

  const summary = {
    prayer: entries.filter((entry) => entry.prayerCompleted).length,
    bible: entries.filter((entry) => entry.bibleReading).length,
    liturgy: entries.filter((entry) => entry.liturgyAttendance).length,
    confession: entries.filter((entry) => entry.confession).length,
  };

  const isPending = entriesQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          {t("backToMine")}
        </Button>
      </div>

      <SectionCard className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("servant")}</label>
            {servantsQuery.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={effectiveServantId}
                onValueChange={(value) => {
                  if (typeof value === "string") setServantId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("servantPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {servants.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {t("noServants")}
                    </div>
                  ) : (
                    servants.map((servant) => (
                      <SelectItem key={servant.id} value={servant.id}>
                        {servant.full_name_ar ?? servant.email ?? ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="journal-month">
              {t("month")}
            </label>
            <Input
              id="journal-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
        </div>

        {effectiveServantId ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {selectedServant?.full_name_ar ?? ""}
            </span>
            <Badge variant="outline">
              {t("entries", { count: entries.length })}
            </Badge>
            <Badge variant="secondary">
              {t("prayer", { count: summary.prayer })}
            </Badge>
            <Badge variant="secondary">
              {t("bible", { count: summary.bible })}
            </Badge>
            <Badge variant="secondary">
              {t("liturgy", { count: summary.liturgy })}
            </Badge>
            <Badge variant="secondary">
              {t("confession", { count: summary.confession })}
            </Badge>
          </div>
        ) : null}
      </SectionCard>

      {servantsQuery.error ? (
        <ErrorState title={t("loadError")} message={servantsQuery.error.message} />
      ) : servantsQuery.isLoading ? (
        <SectionCard>
          <div className="space-y-3 p-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </SectionCard>
      ) : servants.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6 text-muted-foreground" />}
          title={t("noServantsTitle")}
          description={t("noServantsDescription")}
        />
      ) : isPending ? (
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
              </article>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
