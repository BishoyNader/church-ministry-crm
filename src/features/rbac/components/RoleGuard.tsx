"use client";

import { useMemo } from "react";
import { useRoles } from "../hooks/useRoles";

export function RoleGuard({
  role,
  children,
  fallback = null,
}: {
  role: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { data, isLoading } = useRoles();

  const allowed = useMemo(() => {
    const roles = data ?? [];
    return roles.some((currentRole) => currentRole.role_type === role || currentRole.id === role);
  }, [data, role]);

  if (isLoading) {
    return null;
  }

  return allowed ? <>{children}</> : <>{fallback}</>;
}
