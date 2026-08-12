"use client";

import { useMemo, useState } from "react";
import { Menu, Moon, Sun, Church, Users, UserRound, CalendarDays, BarChart3, Settings, LogOut, ClipboardCheck, ClipboardList, Phone, HandHeart, BadgeCheck, Bell, BookOpen, ArrowLeftRight, ScrollText, Building2, School, LayoutDashboard, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { logoutAction } from "@/features/auth/actions/auth.actions";
import { useAccessState, PERMISSION_CODES, type PermissionCode } from "@/features/rbac";
import { useNotificationSummary } from "@/features/notifications/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { useDirection } from "@/lib/direction";

type NavItem = {
  labelKey: string;
  href: string | null;
  icon: LucideIcon;
  permission?: PermissionCode;
  /** Optional role whitelist (role_type values). When present, the item is
   * hidden from every other role even if the permission is held — e.g.
   * servant attendance is restricted to Church Manager / sector admin / stage
   * manager, so plain servants never see a dead link. */
  roles?: string[];
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: BarChart3, permission: PERMISSION_CODES.REPORTS_READ, disabled: false },
  { labelKey: "reports", href: "/reports", icon: BarChart3, permission: PERMISSION_CODES.REPORTS_READ, disabled: false },
  { labelKey: "children", href: "/children", icon: UserRound, permission: PERMISSION_CODES.BENEFICIARIES_READ, disabled: false },
  { labelKey: "attendance", href: "/attendance", icon: ClipboardCheck, permission: PERMISSION_CODES.ATTENDANCE_READ, disabled: false },
  { labelKey: "servantAttendance", href: "/servant-attendance", icon: ClipboardList, permission: PERMISSION_CODES.ATTENDANCE_READ, roles: ["super_admin", "admin", "stage_manager"], disabled: false },
  { labelKey: "followups", href: "/followups", icon: Phone, permission: PERMISSION_CODES.FOLLOWUPS_READ, disabled: false },
  { labelKey: "servantRecords", href: "/servants", icon: HandHeart, permission: PERMISSION_CODES.SERVANTS_READ, disabled: false },
  { labelKey: "approvals", href: "/approvals", icon: BadgeCheck, permission: PERMISSION_CODES.SERVANTS_APPROVE, disabled: false },
  { labelKey: "spiritualJournal", href: "/spiritual-journal", icon: BookOpen, permission: PERMISSION_CODES.SPIRITUAL_READ, disabled: false },
  { labelKey: "notifications", href: "/notifications", icon: Bell, permission: PERMISSION_CODES.NOTIFICATIONS_READ, disabled: false },
  { labelKey: "importExport", href: "/import-export", icon: ArrowLeftRight, permission: PERMISSION_CODES.IMPORT_EXECUTE, disabled: false },
  { labelKey: "services", href: "/services", icon: Building2, permission: PERMISSION_CODES.SERVICES_READ, disabled: false },
  { labelKey: "classes", href: "/classes", icon: School, permission: PERMISSION_CODES.CLASSES_READ, disabled: false },
  { labelKey: "churches", href: "/admin/churches", icon: Building2, permission: PERMISSION_CODES.TENANTS_READ, disabled: false },
  { labelKey: "churchRequests", href: "/admin/church-requests", icon: ClipboardList, permission: PERMISSION_CODES.TENANTS_READ, disabled: false },
  { labelKey: "adminDashboard", href: "/admin/dashboard", icon: LayoutDashboard, permission: PERMISSION_CODES.TENANTS_READ, disabled: false },
  { labelKey: "servants", href: "/users", icon: Users, permission: PERMISSION_CODES.USERS_READ, disabled: false },
  { labelKey: "audit", href: "/audit", icon: ScrollText, permission: PERMISSION_CODES.AUDIT_READ, disabled: false },
  { labelKey: "events", href: "/events", icon: CalendarDays, permission: PERMISSION_CODES.EVENTS_READ, disabled: false },
  { labelKey: "promotions", href: "/promotions", icon: ArrowUpRight, permission: PERMISSION_CODES.SETTINGS_UPDATE, disabled: false },
  { labelKey: "settings", href: "/settings", icon: Settings, permission: PERMISSION_CODES.SETTINGS_READ, disabled: false },
];

function getActivePath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "ar" || parts[0] === "en") {
    return "/" + (parts.slice(1).join("/") || "");
  }
  return pathname;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const dir = useDirection();
  const isRtl = dir === "rtl";

  const activePath = getActivePath(pathname);
  const locale = useLocale();

  const { data: accessState, isLoading: isAccessLoading } = useAccessState();
  const permissionSet = useMemo(
    () => new Set((accessState?.permissions ?? []).map((permission) => permission.code)),
    [accessState?.permissions],
  );
  const canViewNotifications = permissionSet.has(PERMISSION_CODES.NOTIFICATIONS_READ);
  const { data: notificationSummary } = useNotificationSummary(canViewNotifications);

  const visibleNavItems = useMemo(() => {
    const roleTypes = new Set((accessState?.roles ?? []).map((role) => role.role_type));
    return navItems.filter((item) => {
      if (item.disabled) {
        return true;
      }
      if (item.permission && !permissionSet.has(item.permission)) {
        return false;
      }
      if (item.roles && !item.roles.some((role) => roleTypes.has(role))) {
        return false;
      }
      return true;
    });
  }, [permissionSet, accessState?.roles]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const result = await logoutAction(locale);
    setIsSigningOut(false);

    if (result.success && result.redirectTo) {
      router.push("/login");
    }
  };

  const renderNavLink = (item: NavItem, handleClick?: () => void) => {
    const Icon = item.icon;
    const isActive = item.href !== null && activePath === item.href;

    if (item.disabled) {
      return (
        <span
          key={item.labelKey}
          className="flex cursor-not-allowed items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground/60"
          title={t("nav.comingSoon")}
        >
          <Icon className="size-4 shrink-0 opacity-50" />
          <span className="opacity-60">{t(`nav.${item.labelKey}`)}</span>
          <Badge variant="outline" className="ms-auto px-1.5 py-0 text-[10px] uppercase leading-none text-muted-foreground">
            {t("nav.comingSoon")}
          </Badge>
        </span>
      );
    }

    return (
      <Link
        key={item.labelKey}
        href={item.href!}
        aria-current={isActive ? "page" : undefined}
        onClick={handleClick}
        className={cn(
          "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-ministry/10 text-ministry shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon className={cn("size-4 shrink-0 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-105")} />
        <span className={cn(isActive && "font-semibold")}>{t(`nav.${item.labelKey}`)}</span>
        {isActive && (
          <span className="ms-auto h-1.5 w-1.5 rounded-full bg-ministry" />
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <nav className="mt-8 space-y-1" aria-label={t("nav.mainNavigation")}>
      {visibleNavItems.map((item) => renderNavLink(item))}
    </nav>
  );

  const mobileNavContent = (
    <nav className="flex flex-col gap-1 p-4" aria-label={t("nav.mainNavigation")}>
      {visibleNavItems.map((item) => {
        if (item.disabled) return null;
        return renderNavLink(item, () => setMobileOpen(false));
      })}
    </nav>
  );

  const navSkeleton = (
    <nav className="mt-8 space-y-2 px-3" aria-label={t("nav.mainNavigation")}>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-2xl" />
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface-dashboard text-foreground transition-colors" dir={dir}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        {t("nav.skipToContent")}
      </a>
      <div className={cn("flex min-h-screen", isRtl && "flex-row-reverse")}>
        <aside className="hidden w-72 flex-col border-e border-border-whisper bg-surface-elevated p-6 lg:flex">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-2 text-primary-foreground shadow-diffused-sm">
              <Church className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Church CRM</p>
              <p className="text-xs text-muted-foreground">{t("nav.tagline")}</p>
            </div>
          </Link>

          {isAccessLoading ? navSkeleton : sidebarContent}

          <div className="mt-auto rounded-2xl border border-border-whisper bg-muted p-4 text-sm shadow-diffused-sm">
            <p className="font-semibold">{t("nav.footerTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("nav.footerDescription")}</p>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="border-b border-border-whisper bg-surface-elevated/80 px-4 py-4 backdrop-blur sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      aria-label={t("nav.toggleMenu")}
                      aria-expanded={mobileOpen}
                      aria-controls="mobile-navigation"
                    >
                      <Menu className="size-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side={isRtl ? "right" : "left"} showCloseButton={false} id="mobile-navigation">
                    <SheetTitle className="sr-only">{t("nav.mainNavigation")}</SheetTitle>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-3 px-4 pt-6"
                      onClick={() => setMobileOpen(false)}
                    >
                      <div className="rounded-2xl bg-primary p-2 text-primary-foreground shadow-diffused-sm">
                        <Church className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Church CRM</p>
                        <p className="text-xs text-muted-foreground">{t("nav.tagline")}</p>
                      </div>
                    </Link>
                    {isAccessLoading ? null : mobileNavContent}
                  </SheetContent>
                </Sheet>

                <div>
                  <p className="text-sm font-semibold">{t("nav.greeting")}</p>
                  <p className="text-sm text-muted-foreground">{t("nav.welcomeBack")}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canViewNotifications ? (
                  <Link href="/notifications" className="relative">
                    <Button variant="ghost" size="icon" aria-label={t("nav.notifications")}>
                      <Bell className="size-4" />
                    </Button>
                    {(notificationSummary?.unreadCount ?? 0) > 0 ? (
                      <span
                        className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
                        aria-label={t("nav.notifications") + ": " + (notificationSummary?.unreadCount ?? 0)}
                      >
                        {notificationSummary?.unreadCount ?? 0}
                      </span>
                    ) : null}
                  </Link>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("nav.toggleTheme")}
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("nav.signOut")}
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  aria-busy={isSigningOut}
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8" id="main-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
