"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { useAccessState, PERMISSION_CODES } from "@/features/rbac";
import { AdminChurchRequestsPage } from "@/features/churches/components/admin-church-requests-page";
import { ApprovalStatsCards } from "./approval-stats-cards";
import { ServantApprovalsTab } from "./servant-approvals-tab";
import { UserApprovalsTab } from "./user-approvals-tab";
import { ApprovalDetailDrawer } from "./approval-detail-drawer";
import { useApprovalCenterStats } from "../hooks/use-approval-center";
import type { PendingRegistration } from "@/features/users/services/approval.service";

export function ApprovalCenterPage() {
  const t = useTranslations("approvals");
  const statsQuery = useApprovalCenterStats();
  const { data: accessState } = useAccessState();

  const canReviewChurchRequests = (accessState?.permissions ?? []).some(
    (permission) => permission.code === PERMISSION_CODES.TENANTS_READ,
  );

  const [reviewTarget, setReviewTarget] = useState<PendingRegistration | null>(null);

  return (
    <section className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <ApprovalStatsCards data={statsQuery.data?.data} isLoading={statsQuery.isLoading} />

      <Tabs defaultValue="servants">
        <TabsList>
          <TabsTrigger value="servants">{t("tabs.servants")}</TabsTrigger>
          <TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>
          {canReviewChurchRequests ? (
            <TabsTrigger value="churches">{t("tabs.churches")}</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="servants">
          <ServantApprovalsTab onReview={setReviewTarget} />
        </TabsContent>

        <TabsContent value="users">
          <UserApprovalsTab onReview={setReviewTarget} />
        </TabsContent>

        {canReviewChurchRequests ? (
          <TabsContent value="churches">
            <AdminChurchRequestsPage />
          </TabsContent>
        ) : null}
      </Tabs>

      <ApprovalDetailDrawer
        key={reviewTarget?.id ?? "closed"}
        registration={reviewTarget}
        onClose={() => setReviewTarget(null)}
      />
    </section>
  );
}
