import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations("notFound");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-dashboard px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 start-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 end-8 h-72 w-72 rounded-full bg-ministry/10 blur-3xl" />
      </div>
      <div className="relative max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ministry">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("description")}</p>
        <Button render={<Link href={`/${locale}`} />} className="mt-8">
          <Home className="size-4" />
          {t("goHome")}
        </Button>
      </div>
    </main>
  );
}
