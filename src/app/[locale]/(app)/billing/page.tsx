import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { PermissionGuard } from "@/features/rbac";
import { BillingPage } from "@/features/billing/components/billing-page";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function BillingRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  // Server-side separation (not just UI): the Platform Owner administers
  // church subscriptions and must never land on the customer billing /
  // pricing experience.
  const supabase = await createClient();
  const { data: isPlatformOwner } = await supabase.rpc("user_is_platform_owner");
  if (isPlatformOwner) {
    redirect(`/${locale}/admin/billing`);
  }

  return (
    <PermissionGuard permission="billing.read">
      <BillingPage />
    </PermissionGuard>
  );
}
