import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CopticCross } from "@/components/brand/coptic-cross";
import { CopticPattern } from "@/components/brand/coptic-pattern";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export async function AuthPage({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const t = await getTranslations("auth.brand");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-dashboard px-4 py-12 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -start-40 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -end-32 bottom-0 h-80 w-80 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="absolute end-4 top-4 z-20 sm:end-6 sm:top-6">
        <LocaleSwitcher />
      </div>

      <div className="relative grid w-full max-w-6xl items-stretch gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-0 lg:overflow-hidden lg:rounded-3xl lg:border lg:border-border-whisper lg:bg-surface-elevated lg:shadow-diffused-lg">
        <aside
          aria-hidden="true"
          className="relative hidden overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between"
        >
          <div className="absolute inset-0 opacity-30">
            <CopticPattern className="h-full w-full" />
          </div>

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-gold/40 bg-gold/15 p-2.5 text-gold shadow-diffused-sm">
                <CopticCross className="size-6" />
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight">Church CRM</p>
                <p className="text-xs text-primary-foreground/70">{t("tagline")}</p>
              </div>
            </div>
          </div>

          <div className="relative mt-auto max-w-sm pt-16">
            <span className="mb-4 block h-px w-12 bg-gold/70" aria-hidden="true" />
            <blockquote className="text-xl font-medium leading-9">
              {t("quote")}
            </blockquote>
            <p className="mt-3 text-sm text-primary-foreground/70">{t("quoteRef")}</p>
          </div>
        </aside>

        <div className="flex flex-col items-center justify-center lg:px-10 lg:py-14">
          <Link
            href={`/${locale}`}
            className="mb-8 flex flex-col items-center gap-2 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 lg:hidden"
          >
            <div className="rounded-2xl bg-primary p-2.5 text-primary-foreground shadow-diffused-md">
              <CopticCross className="size-6" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Church CRM</span>
          </Link>
          {children}
        </div>
      </div>
    </main>
  );
}
