import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PermissionGuard } from "@/features/rbac";
import { PlatformBillingPage } from "@/features/billing/components/platform-billing-page";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PlatformBillingRoute({
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
    <PermissionGuard permission="subscriptions.manage">
      <PlatformBillingPage />
    </PermissionGuard>
  );
}
