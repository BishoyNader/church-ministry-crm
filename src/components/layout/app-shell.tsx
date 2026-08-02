"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Moon, Sun, Church, Users, Layers, UserRound, CalendarDays, BarChart3, Settings, LogOut, ClipboardCheck, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { logoutAction } from "@/features/auth/actions/auth.actions";
import { cn } from "@/lib/utils";
import { useDirection } from "@/lib/direction";

const navItems = [
  { labelKey: "dashboard", href: "/dashboard", icon: BarChart3, disabled: false },
  { labelKey: "children", href: "/children", icon: UserRound, disabled: false },
  { labelKey: "attendance", href: "/attendance", icon: ClipboardCheck, disabled: false },
  { labelKey: "followups", href: "/followups", icon: Phone, disabled: false },
  { labelKey: "stages", href: "/stages", icon: Layers, disabled: false },
  { labelKey: "users", href: "/users", icon: Users, disabled: false },
  { labelKey: "events", href: null, icon: CalendarDays, disabled: true },
  { labelKey: "settings", href: null, icon: Settings, disabled: true },
] as const;

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
  const locale = pathname.startsWith("/ar") ? "ar" : "en";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const result = await logoutAction(locale);
    setIsSigningOut(false);

    if (result.success && result.redirectTo) {
      router.push(result.redirectTo);
    }
  };

  const renderNavLink = (item: typeof navItems[number], handleClick?: () => void) => {
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
      {navItems.map((item) => renderNavLink(item))}
    </nav>
  );

  const mobileNavContent = (
    <nav className="flex flex-col gap-1 p-4" aria-label={t("nav.mainNavigation")}>
      {navItems.map((item) => {
        if (item.disabled) return null;
        return renderNavLink(item, () => setMobileOpen(false));
      })}
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
          <Link href={`/${locale}/dashboard`} className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-2 text-primary-foreground shadow-diffused-sm">
              <Church className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Church CRM</p>
              <p className="text-xs text-muted-foreground">{t("nav.tagline")}</p>
            </div>
          </Link>

          {sidebarContent}

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
                    <Link
                      href={`/${locale}/dashboard`}
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
                    {mobileNavContent}
                  </SheetContent>
                </Sheet>

                <div>
                  <p className="text-sm font-semibold">{t("nav.greeting")}</p>
                  <p className="text-sm text-muted-foreground">{t("nav.welcomeBack")}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
