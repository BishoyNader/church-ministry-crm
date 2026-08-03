"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "../hooks/usePermissions";
import type { PermissionCode } from "../constants/permissions";

function AccessDenied() {
  const t = useTranslations("rbac");

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-whisper bg-surface-elevated px-6 py-16 text-center shadow-diffused-sm"
    >
      <div className="rounded-2xl bg-muted p-4 text-muted-foreground">
        <Lock className="size-8" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">
        {t("accessDenied.title")}
      </h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        {t("accessDenied.description")}
      </p>
      <div className="mt-6">
        <Button render={<Link href="/dashboard" />} variant="outline">
          {t("accessDenied.backToDashboard")}
        </Button>
      </div>
    </div>
  );
}

function AccessDeniedSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

export function PermissionGuard({
  permission,
  children,
  fallback,
}: {
  permission: PermissionCode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { data, isLoading } = usePermissions();

  const allowed = useMemo(() => {
    const permissions = data?.permissions ?? [];
    return permissions.some((currentPermission) => currentPermission.code === permission);
  }, [data?.permissions, permission]);

  if (isLoading) {
    return <AccessDeniedSkeleton />;
  }

  return allowed ? <>{children}</> : <>{fallback ?? <AccessDenied />}</>;
}
