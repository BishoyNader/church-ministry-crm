"use client";

import { useMemo, useState } from "react";
import { Menu, Moon, Sun, Users, UserRound, CalendarDays, BarChart3, Settings, LogOut, ClipboardCheck, ClipboardList, Phone, HandHeart, BadgeCheck, Bell, BookOpen, ArrowLeftRight, ScrollText, Building2, School, LayoutDashboard, ArrowUpRight, Layers, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CopticCross } from "@/components/brand/coptic-cross";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { logoutAction } from "@/features/auth/actions/auth.actions";
import { useAccessState, PERMISSION_CODES, type PermissionCode } from "@/features/rbac";
import { useNotificationSummary } from "@/features/notifications/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { useDirection } from "@/lib/direction";

type NavSection = "overview" | "ministry" | "people" | "operations" | "spiritual" | "administration";

type NavItem = {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  section: NavSection;
  permission?: PermissionCode;
  /** Optional role whitelist (role_type values). When present, the item is
   * hidden from every other role even if the permission is held — e.g.
   * servant attendance is restricted to Church Manager / sector admin / stage
   * manager, so plain servants never see a dead link. */
  roles?: string[];
};

const NAV_SECTIONS: NavSection[] = [
  "overview",
  "ministry",
  "people",
  "operations",
  "spiritual",
  "administration",
];

// Static label keys per section so the i18n checker can resolve them and
// the section headers stay type-safe.
const SECTION_TITLE_KEYS: Record<NavSection, string> = {
  overview: "sectionOverview",
  ministry: "sectionMinistry",
  people: "sectionPeople",
  operations: "sectionOperations",
  spiritual: "sectionSpiritual",
  administration: "sectionAdministration",
};

const navItems: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: BarChart3, section: "overview", permission: PERMISSION_CODES.REPORTS_READ },
  { labelKey: "reports", href: "/reports", icon: BarChart3, section: "overview", permission: PERMISSION_CODES.REPORTS_READ },
  { labelKey: "adminDashboard", href: "/admin/dashboard", icon: LayoutDashboard, section: "overview", permission: PERMISSION_CODES.TENANTS_READ },
  { labelKey: "services", href: "/services", icon: Building2, section: "ministry", permission: PERMISSION_CODES.SERVICES_READ },
  { labelKey: "stages", href: "/stages", icon: Layers, section: "ministry", permission: PERMISSION_CODES.SERVICES_READ },
  { labelKey: "classes", href: "/classes", icon: School, section: "ministry", permission: PERMISSION_CODES.CLASSES_READ },
  { labelKey: "events", href: "/events", icon: CalendarDays, section: "ministry", permission: PERMISSION_CODES.EVENTS_READ },
  { labelKey: "children", href: "/children", icon: UserRound, section: "people", permission: PERMISSION_CODES.BENEFICIARIES_READ },
  { labelKey: "followups", href: "/followups", icon: Phone, section: "people", permission: PERMISSION_CODES.FOLLOWUPS_READ },
  { labelKey: "servantRecords", href: "/servants", icon: HandHeart, section: "people", permission: PERMISSION_CODES.SERVANTS_READ },
  { labelKey: "users", href: "/users", icon: Users, section: "people", permission: PERMISSION_CODES.USERS_READ },
  { labelKey: "attendance", href: "/attendance", icon: ClipboardCheck, section: "operations", permission: PERMISSION_CODES.ATTENDANCE_READ },
  { labelKey: "servantAttendance", href: "/servant-attendance", icon: ClipboardList, section: "operations", permission: PERMISSION_CODES.ATTENDANCE_READ, roles: ["super_admin", "admin", "stage_manager"] },
  { labelKey: "approvals", href: "/approvals", icon: BadgeCheck, section: "operations", permission: PERMISSION_CODES.SERVANTS_APPROVE },
  { labelKey: "promotions", href: "/promotions", icon: ArrowUpRight, section: "operations", permission: PERMISSION_CODES.SETTINGS_UPDATE },
  { labelKey: "spiritualJournal", href: "/spiritual-journal", icon: BookOpen, section: "spiritual", permission: PERMISSION_CODES.SPIRITUAL_READ },
  { labelKey: "churches", href: "/admin/churches", icon: Building2, section: "administration", permission: PERMISSION_CODES.TENANTS_READ },
  { labelKey: "churchRequests", href: "/admin/church-requests", icon: ClipboardList, section: "administration", permission: PERMISSION_CODES.TENANTS_READ },
  { labelKey: "importExport", href: "/import-export", icon: ArrowLeftRight, section: "administration", permission: PERMISSION_CODES.IMPORT_EXECUTE },
  { labelKey: "audit", href: "/audit", icon: ScrollText, section: "administration", permission: PERMISSION_CODES.AUDIT_READ },
  { labelKey: "notifications", href: "/notifications", icon: Bell, section: "administration", permission: PERMISSION_CODES.NOTIFICATIONS_READ },
  { labelKey: "settings", href: "/settings", icon: Settings, section: "administration", permission: PERMISSION_CODES.SETTINGS_READ },
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
  const t = useTranslations("nav");
  const locale = useLocale();
  const dir = useDirection();
  const isRtl = dir === "rtl";

  const activePath = getActivePath(pathname);

  const { data: accessState, isLoading: isAccessLoading } = useAccessState();
  const permissionSet = useMemo(
    () => new Set((accessState?.permissions ?? []).map((permission) => permission.code)),
    [accessState?.permissions],
  );
  const canViewNotifications = permissionSet.has(PERMISSION_CODES.NOTIFICATIONS_READ);
  const { data: notificationSummary } = useNotificationSummary(canViewNotifications);

  const primaryRole = useMemo(() => {
    const roles = accessState?.roles ?? [];
    if (roles.length === 0) return null;
    const name = locale === "ar" ? roles[0].name_ar : (roles[0].name_en ?? roles[0].name_ar);
    return name;
  }, [accessState?.roles, locale]);

  const groupedNav = useMemo(() => {
    const roleTypes = new Set((accessState?.roles ?? []).map((role) => role.role_type));
    const visible = navItems.filter((item) => {
      if (item.permission && !permissionSet.has(item.permission)) {
        return false;
      }
      if (item.roles && !item.roles.some((role) => roleTypes.has(role))) {
        return false;
      }
      return true;
    });
    return NAV_SECTIONS.map((section) => ({
      section,
      items: visible.filter((item) => item.section === section),
    })).filter((group) => group.items.length > 0);
  }, [permissionSet, accessState?.roles]);

  const greetingKey = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "greetingMorning";
    if (hour < 18) return "greetingAfternoon";
    return "greetingEvening";
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const result = await logoutAction(locale);
    setIsSigningOut(false);

    if (result.success && result.redirectTo) {
      router.push("/login");
    }
  };

  const renderNavGroup = (section: NavSection, items: NavItem[], handleClick?: () => void) => (
    <div key={section} className="space-y-0.5">
      <p className="mb-1.5 px-3 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        {t(SECTION_TITLE_KEYS[section])}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => renderNavLink(item, handleClick))}
      </div>
    </div>
  );

  const renderNavLink = (item: NavItem, handleClick?: () => void) => {
    const Icon = item.icon;
    const isActive = activePath === item.href;

    return (
      <Link
        key={item.labelKey}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        onClick={handleClick}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 active:scale-[0.98]",
          isActive
            ? "border-s-2 border-ministry bg-ministry/10 text-ministry shadow-sm"
            : "border-s-2 border-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground active:scale-[0.98]",
        )}
      >
        <Icon className={cn("size-4 shrink-0", isActive && "text-ministry")} />
        <span className={cn("truncate", isActive && "font-semibold")}>{t(item.labelKey)}</span>
        {isActive ? <span className="ms-auto size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" /> : null}
      </Link>
    );
  };

  const sidebarContent = (
    <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-2" aria-label={t("mainNavigation")}>
      {groupedNav.map((group) => renderNavGroup(group.section, group.items))}
    </nav>
  );

  const navSkeleton = (
    <nav className="mt-6 space-y-3 px-3" aria-label={t("mainNavigation")}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      ))}
    </nav>
  );

  const mobileNavContent = (
    <nav className="flex flex-col gap-3 overflow-y-auto p-4 pt-2" aria-label={t("mainNavigation")}>
      {groupedNav.map((group) => renderNavGroup(group.section, group.items, () => setMobileOpen(false)))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface-dashboard text-foreground transition-colors" dir={dir}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        {t("skipToContent")}
      </a>
      <div className={cn("flex min-h-screen", isRtl && "flex-row-reverse")}>
        <aside className="hidden w-72 flex-col border-e border-border-whisper bg-surface-elevated px-4 py-5 shadow-diffused-md lg:flex">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-2 transition-opacity duration-150 hover:opacity-80">
            <div className="rounded-2xl bg-primary p-2 text-primary-foreground shadow-diffused-sm">
              <CopticCross className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Church CRM</p>
              <p className="text-xs text-muted-foreground">{t("tagline")}</p>
            </div>
          </Link>

          {primaryRole ? (
            <div className="mx-2 mt-4 flex items-center gap-2 rounded-xl border border-border-whisper bg-muted/60 px-3 py-2">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ministry/40" />
                <span className="relative inline-flex size-2 rounded-full bg-ministry" />
              </span>
              <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                {t("roleBadge")}: <span className="font-semibold text-foreground">{primaryRole}</span>
              </p>
            </div>
          ) : null}

          {isAccessLoading ? navSkeleton : sidebarContent}

          <div className="mt-4 rounded-2xl border border-border-whisper bg-gradient-to-br from-primary/5 via-transparent to-gold/10 p-4 text-sm shadow-diffused-sm">
            <p className="font-semibold">{t("footerTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("footerDescription")}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border-whisper bg-surface-elevated/80 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:px-6">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        aria-label={t("toggleMenu")}
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-navigation"
                      />
                    }
                  >
                    <Menu className="size-4" />
                  </SheetTrigger>
                  <SheetContent side={isRtl ? "right" : "left"} showCloseButton={false} id="mobile-navigation">
                    <SheetTitle className="sr-only">{t("mainNavigation")}</SheetTitle>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-3 px-4 pt-6"
                      onClick={() => setMobileOpen(false)}
                    >
                      <div className="rounded-2xl bg-primary p-2 text-primary-foreground shadow-diffused-sm">
                        <CopticCross className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold tracking-tight">Church CRM</p>
                        <p className="text-xs text-muted-foreground">{t("tagline")}</p>
                      </div>
                    </Link>
                    {isAccessLoading ? null : mobileNavContent}
                  </SheetContent>
                </Sheet>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t(greetingKey)}</p>
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">{t("welcomeBack")}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {canViewNotifications ? (
                  <Link href="/notifications" className="relative" aria-label={t("notifications")}>
                    <Button variant="ghost" size="icon">
                      <Bell className="size-4" />
                    </Button>
                    {(notificationSummary?.unreadCount ?? 0) > 0 ? (
                      <span
                        className="absolute -end-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
                        aria-label={t("notifications") + ": " + (notificationSummary?.unreadCount ?? 0)}
                      >
                        {notificationSummary?.unreadCount ?? 0}
                      </span>
                    ) : null}
                  </Link>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("toggleTheme")}
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("signOut")}
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  aria-busy={isSigningOut}
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-3 sm:p-6 lg:p-8" id="main-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
