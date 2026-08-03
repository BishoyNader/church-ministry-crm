"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccessState } from "@/features/rbac";
import { useProfileSettings } from "../hooks/use-settings";
import { ProfileSettingsCard } from "@/features/settings/components/profile-settings-card";
import { ChurchSettingsCard } from "@/features/settings/components/church-settings-card";
import { ChangePasswordCard } from "@/features/settings/components/change-password-card";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { ErrorState } from "@/components/feedback/error-state";

export function SettingsPage() {
  const t = useTranslations("settings");
  const { data: accessState, isLoading: isAccessLoading } = useAccessState();
  const { data, isLoading, error } = useProfileSettings();

  const canManageChurch = useMemo(() => {
    const roles = accessState?.roles ?? [];
    return roles.some(
      (role) => role.role_type === "super_admin" || role.role_type === "platform_owner",
    );
  }, [accessState?.roles]);

  if (isLoading || isAccessLoading) {
    return (
      <section className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <SectionCard>
          <div className="space-y-3 p-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </SectionCard>
      </section>
    );
  }

  if (error) return <ErrorState title={t("loadError")} message={error.message} />;

  const profile = data?.data;

  return (
    <section className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      {profile ? <ProfileSettingsCard profile={profile} /> : null}
      {canManageChurch ? <ChurchSettingsCard /> : null}
      <ChangePasswordCard />
    </section>
  );
}