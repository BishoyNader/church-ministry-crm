"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { PermissionGuard } from "@/features/rbac";
import { useRouter } from "@/i18n/navigation";
import { useChurchDetail, useChurchStats, useChurchAudit } from "../hooks/use-churches";
import { ChurchFormDialog } from "./church-form-dialog";
import { ChurchStatusBadge } from "./church-status-badge";
import { ChurchManagerCard } from "./church-manager-card";
import { ChurchStatusConfirmDialog } from "./church-status-confirm-dialog";
import { ChurchUsersTable } from "./church-users-table";
import { ChurchEntityTable } from "./church-entity-table";
import { ChurchAuditTable } from "./church-audit-table";
import { ChurchReportsTab } from "./church-reports-tab";
import { ChurchChildrenTab } from "./church-children-tab";

type ChurchDetailPageProps = {
  churchId: string;
  initialTab?: string;
  onBack?: () => void;
};

type StatCardProps = {
  label: string;
  value: string | number;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <SectionCard className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </SectionCard>
  );
}

export function ChurchDetailPage({ churchId, initialTab = "overview", onBack }: ChurchDetailPageProps) {
  const t = useTranslations("churches");

  const { data: detailResult, isLoading: detailLoading, error: detailError } = useChurchDetail(churchId);
  const { data: statsResult, isLoading: statsLoading } = useChurchStats(churchId);
  const { data: auditResult } = useChurchAudit(churchId, 1, 5);

  const [editOpen, setEditOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<"active" | "inactive" | "suspended" | "disabled">("inactive");
  const [statusOpen, setStatusOpen] = useState(false);

  const church = detailResult?.data;
  const stats = statsResult?.data;
  const latestAudit = auditResult?.data?.rows?.[0] ?? null;

  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  const isLoading = detailLoading || statsLoading;
  const error = detailError;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Button variant="outline" onClick={handleBack}>
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
            <Button variant="outline" onClick={handleBack}>
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

  const requestStatus = (status: "active" | "inactive" | "suspended" | "disabled") => {
    setStatusTarget(status);
    setStatusOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={church.name_ar}
        description={church.name_en ?? church.slug}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="size-4" />
              {t("back")}
            </Button>
            <PermissionGuard permission="tenants.update">
              {church.status === "active" && (
                <>
                  <Button variant="outline" onClick={() => requestStatus("inactive")}>
                    <UserX className="size-4" />
                    {t("deactivate")}
                  </Button>
                  <Button variant="outline" onClick={() => requestStatus("suspended")}>
                    <ShieldAlert className="size-4" />
                    {t("suspend")}
                  </Button>
                  <Button variant="outline" onClick={() => requestStatus("disabled")}>
                    <ShieldX className="size-4" />
                    {t("disable")}
                  </Button>
                </>
              )}
              {church.status === "inactive" && (
                <>
                  <Button variant="outline" onClick={() => requestStatus("active")}>
                    <UserCheck className="size-4" />
                    {t("activate")}
                  </Button>
                  <Button variant="outline" onClick={() => requestStatus("disabled")}>
                    <ShieldX className="size-4" />
                    {t("disable")}
                  </Button>
                </>
              )}
              {church.status === "suspended" && (
                <>
                  <Button variant="outline" onClick={() => requestStatus("active")}>
                    <ShieldCheck className="size-4" />
                    {t("reactivate")}
                  </Button>
                  <Button variant="outline" onClick={() => requestStatus("disabled")}>
                    <ShieldX className="size-4" />
                    {t("disable")}
                  </Button>
                </>
              )}
              {church.status === "disabled" && (
                <Button variant="outline" onClick={() => requestStatus("active")}>
                  <ShieldCheck className="size-4" />
                  {t("reactivate")}
                </Button>
              )}
              <Button onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                {t("edit")}
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <ChurchStatusBadge status={church.status} />
        <span className="text-sm text-muted-foreground">{church.slug}</span>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="w-full flex-wrap justify-start overflow-x-auto">
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>
          <TabsTrigger value="services">{t("tabs.services")}</TabsTrigger>
          <TabsTrigger value="stages">{t("tabs.stages")}</TabsTrigger>
          <TabsTrigger value="classes">{t("tabs.classes")}</TabsTrigger>
          <TabsTrigger value="children">{t("tabs.children")}</TabsTrigger>
          <TabsTrigger value="reports">{t("tabs.reports")}</TabsTrigger>
          <TabsTrigger value="audit">{t("tabs.audit")}</TabsTrigger>
          <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ChurchManagerCard church={church} />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t("counts.members")} value={stats?.memberCount ?? 0} />
            <StatCard label={t("counts.servants")} value={stats?.servantCount ?? 0} />
            <StatCard label={t("counts.children")} value={stats?.childCount ?? 0} />
            <StatCard label={t("counts.services")} value={stats?.serviceCount ?? 0} />
            <StatCard label={t("counts.stages")} value={stats?.stageCount ?? 0} />
            <StatCard label={t("counts.classes")} value={stats?.classCount ?? 0} />
            <StatCard
              label={t("attendanceRate")}
              value={stats?.attendanceRate === null ? "—" : `${stats?.attendanceRate ?? 0}%`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard className="p-4">
              <p className="mb-3 font-medium">{t("latestAuditEvent")}</p>
              {latestAudit ? (
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">{latestAudit.action}</span> · {latestAudit.entityType}
                  </p>
                  <p className="text-muted-foreground">
                    {latestAudit.actorName ?? latestAudit.actorEmail ?? "—"} · {new Date(latestAudit.createdAt).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("audit.emptyState")}</p>
              )}
            </SectionCard>

            <SectionCard className="p-4">
              <p className="mb-3 font-medium">{t("recentActivity")}</p>
              <ChurchAuditTable churchId={church.id} limit={5} />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <ChurchUsersTable churchId={church.id} />
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <ChurchEntityTable churchId={church.id} kind="services" />
        </TabsContent>

        <TabsContent value="stages" className="space-y-6">
          <ChurchEntityTable churchId={church.id} kind="stages" />
        </TabsContent>

        <TabsContent value="classes" className="space-y-6">
          <ChurchEntityTable churchId={church.id} kind="classes" />
        </TabsContent>

        <TabsContent value="children" className="space-y-6">
          <ChurchChildrenTab churchId={church.id} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <ChurchReportsTab churchId={church.id} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <ChurchAuditTable churchId={church.id} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <SectionCard>
            <div className="grid gap-4 md:grid-cols-2">
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

          <PermissionGuard permission="tenants.update">
            <div className="flex justify-end">
              <Button onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                {t("edit")}
              </Button>
            </div>
          </PermissionGuard>
        </TabsContent>
      </Tabs>

      <ChurchFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        church={church}
      />

      <ChurchStatusConfirmDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        churchId={church.id}
        status={statusTarget}
      />
    </div>
  );
}
