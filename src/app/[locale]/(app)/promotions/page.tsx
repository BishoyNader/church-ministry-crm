import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PermissionGuard } from "@/features/rbac";
import { PromotionsPage } from "@/features/promotions";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PromotionsRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <PermissionGuard permission="settings.update">
      <PromotionsPage />
    </PermissionGuard>
  );
}
