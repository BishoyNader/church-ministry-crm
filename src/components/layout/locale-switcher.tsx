"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Switches between Arabic (RTL) and English (LTR) while staying on the
 * current route — used on public/auth pages where there is no app sidebar.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");

  const other = locale === "ar" ? "en" : "ar";
  const label = other === "ar" ? "العربية" : "English";

  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      className={className}
      onClick={() => router.replace(pathname, { locale: other })}
      aria-label={t("toggleLanguage")}
    >
      <Languages className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
