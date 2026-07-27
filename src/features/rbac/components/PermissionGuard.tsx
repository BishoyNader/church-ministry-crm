"use client";

import { useMemo } from "react";
import { usePermissions } from "../hooks/usePermissions";
import type { PermissionCode } from "../constants/permissions";

export function PermissionGuard({
  permission,
  children,
  fallback = null,
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
    return null;
  }

  return allowed ? <>{children}</> : <>{fallback}</>;
}
