"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Pencil, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { PermissionGuard } from "@/features/rbac";
import { useChurchDetail, useChurchStats, useActivateChurch, useDeactivateChurch } from "../hooks/use-churches";
import { ChurchFormDialog } from "./church-form-dialog";

type ChurchDetailPageProps = {
  churchId: string;
  onBack?: () => void;
};

export function ChurchDetailPage({ churchId, onBack }: ChurchDetailPageProps) {
  const t = useTranslations("churches");

  const { data: detailResult, isLoading: detailLoading, error: detailError } = useChurchDetail(churchId);
  const { data: statsResult, isLoading: statsLoading } = useChurchStats(churchId);

  const activateMutation = useActivateChurch();
  const deactivateMutation = useDeactivateChurch();

  const [editOpen, setEditOpen] = useState(false);

  const church = detailResult?.data;
  const stats = statsResult?.data;

  const isLoading = detailLoading || statsLoading;
  const error = detailError;

  const handleActivate = async () => {
    if (!church) return;
    try {
      await activateMutation.mutateAsync(church.id);
    } catch {
      // Error is surfaced via mutation error state
    }
  };

  const handleDeactivate = async () => {
    if (!church) return;
    try {
      await deactivateMutation.mutateAsync(church.id);
    } catch {
      // Error is surfaced via mutation error state
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" />
              {t("back")}
            </Button>
          }
        />
        <SectionCard>
          <div className="py-10 text-center text-destructive">{error.message}</div>
        </SectionCard>
      </div>
    );
  }

  if (isLoading || !church) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" />
              {t("back")}
            </Button>
          }
        />
        <SectionCard>
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </SectionCard>
      </div>
    );
  }

  const activateError = activateMutation.error?.message ?? null;
  const deactivateError = deactivateMutation.error?.message ?? null;

  return (
    <div className="space-y-6">
      {(activateError || deactivateError) && (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {activateError || deactivateError}
        </div>
      )}

      <PageHeader
        title={church.name_ar}
        description={church.name_en ?? church.slug}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" />
              {t("back")}
            </Button>
            <PermissionGuard permission="tenants.update">
              {church.is_active ? (
                <Button
                  variant="outline"
                  onClick={handleDeactivate}
                  disabled={deactivateMutation.isPending}
                >
                  <UserX className="size-4" />
                  {t("deactivate")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleActivate}
                  disabled={activateMutation.isPending}
                >
                  <UserCheck className="size-4" />
                  {t("activate")}
                </Button>
              )}
            </PermissionGuard>
            <PermissionGuard permission="tenants.update">
              <Button onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                {t("edit")}
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SectionCard className="p-4">
          <p className="text-sm text-muted-foreground">{t("members")}</p>
          <p className="text-2xl font-semibold">{stats?.memberCount ?? 0}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-sm text-muted-foreground">{t("servants")}</p>
          <p className="text-2xl font-semibold">{stats?.servantCount ?? 0}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-sm text-muted-foreground">{t("services")}</p>
          <p className="text-2xl font-semibold">{stats?.serviceCount ?? 0}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-sm text-muted-foreground">{t("stages")}</p>
          <p className="text-2xl font-semibold">{stats?.stageCount ?? 0}</p>
        </SectionCard>
      </div>

      <SectionCard>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("slug")}</p>
            <p className="mt-1">{church.slug}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("status")}</p>
            <div className="mt-1">
              <Badge variant={church.is_active ? "default" : "secondary"}>
                {church.is_active ? t("statusActive") : t("statusInactive")}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("contactEmail")}</p>
            <p className="mt-1">{church.contact_email ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("contactPhone")}</p>
            <p className="mt-1">{church.contact_phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("addressAr")}</p>
            <p className="mt-1">{church.address_ar ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("addressEn")}</p>
            <p className="mt-1">{church.address_en ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("subscriptionTier")}</p>
            <p className="mt-1">{church.subscription_tier}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("subscriptionStatus")}</p>
            <p className="mt-1">{church.subscription_status}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("locale")}</p>
            <p className="mt-1">{church.locale}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("createdAt")}</p>
            <p className="mt-1">{new Date(church.created_at).toLocaleString()}</p>
          </div>
        </div>
      </SectionCard>

      <ChurchFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        church={church}
      />
    </div>
  );
}
