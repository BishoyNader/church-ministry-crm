"use client";

import { useTranslations, useLocale } from "next-intl";
import { UserPlus, CalendarPlus, ClipboardCheck, BarChart3 } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/features/rbac";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";

const ACTIONS = [
  { key: "addChild", icon: UserPlus, href: (locale: string) => `/${locale}/children`, permission: PERMISSION_CODES.BENEFICIARIES_CREATE },
  { key: "scheduleFollowup", icon: CalendarPlus, href: (locale: string) => `/${locale}/followups`, permission: PERMISSION_CODES.FOLLOWUPS_CREATE },
  { key: "recordAttendance", icon: ClipboardCheck, href: (locale: string) => `/${locale}/attendance`, permission: PERMISSION_CODES.ATTENDANCE_CREATE },
  { key: "viewReports", icon: BarChart3, href: (locale: string) => `/${locale}/dashboard`, permission: PERMISSION_CODES.REPORTS_READ },
] as const;

export function QuickActions() {
  const t = useTranslations("dashboard.quickActions");
  const locale = useLocale();
  const { data, isLoading } = usePermissions();

  const permissions = data?.permissions ?? [];
  const hasPermission = (code: string) => permissions.some((p) => p.code === code);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map(({ key }) => (
          <div
            key={key}
            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="h-[52px] w-[52px] animate-pulse rounded-xl bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const visibleActions = ACTIONS.filter((a) => hasPermission(a.permission));

  if (visibleActions.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {visibleActions.map(({ key, icon: Icon, href }) => (
        <Link
          key={key}
          href={href(locale)}
          className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="rounded-xl bg-muted p-3 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <Icon className="size-5" />
          </div>
          <span className="text-center text-xs font-medium text-muted-foreground group-hover:text-foreground">
            {t(key)}
          </span>
        </Link>
      ))}
    </div>
  );
}
