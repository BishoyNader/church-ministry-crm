"use client";

import { useTranslations } from "next-intl";
import { UserRoundCog, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/layout/section-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { usePendingRegistrations } from "@/features/users";
import type { PendingRegistration } from "@/features/users/services/approval.service";

type UserApprovalsTabProps = {
  onReview: (registration: PendingRegistration) => void;
};

export function UserApprovalsTab({ onReview }: UserApprovalsTabProps) {
  const t = useTranslations("approvals.users");
  const { data, isLoading } = usePendingRegistrations();

  const registrations = data?.data ?? [];

  if (isLoading) {
    return (
      <SectionCard className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </SectionCard>
    );
  }

  if (registrations.length === 0) {
    return (
      <SectionCard className="p-6">
        <EmptyState
          icon={<UserRoundCog className="size-6 text-muted-foreground" />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between px-6 pt-5">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Badge variant="secondary">{registrations.length}</Badge>
      </div>

      <div className="mt-4 divide-y">
        {registrations.map((registration) => (
          <div
            key={registration.id}
            className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-muted/30"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {(registration.profiles?.full_name_ar ?? registration.profiles?.email ?? "?")[0]}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {registration.profiles?.full_name_ar ?? "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {registration.profiles?.email ?? "—"}
                  {registration.profiles?.phone ? ` · ${registration.profiles.phone}` : ""}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onReview(registration)}>
              {t("review")}
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
