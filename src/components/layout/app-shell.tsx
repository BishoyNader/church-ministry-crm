"use client";

import { useState } from "react";
import { Menu, Moon, Sun, Church, Users, CalendarDays, BarChart3, Settings, Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { label: "Dashboard", href: "#", icon: BarChart3 },
  { label: "Members", href: "#", icon: Users },
  { label: "Events", href: "#", icon: CalendarDays },
  { label: "Settings", href: "#", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);

    if (!error) {
      const locale = pathname.startsWith("/ar") ? "ar" : "en";
      router.push(`/${locale}/login`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white/80 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:flex">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-600 p-2 text-white">
              <Church className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Church CRM</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ministry operations</p>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <Icon className="size-4" />
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="font-semibold">Ready for ministry</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">Track members, events, and follow-ups from one place.</p>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setMobileOpen((value) => !value)}
                >
                  <Menu className="size-4" />
                </Button>
                <div>
                  <p className="text-sm font-semibold">Good morning</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back to your church dashboard</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" aria-label="Notifications">
                  <Bell className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Toggle theme"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
                <Button variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut} disabled={isSigningOut}>
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>
          </header>

          {mobileOpen && (
            <div className="border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </a>
                  );
                })}
              </nav>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
