import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PermissionGuard } from "@/features/rbac";
import { ChurchDetailPage } from "@/features/churches/components/church-detail-page";

type Props = {
  params: Promise<{ locale: string; churchId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ChurchDetailRoute({ params, searchParams }: Props) {
  const [{ locale, churchId }, { tab }] = await Promise.all([params, searchParams]);

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <PermissionGuard permission="tenants.read">
      <ChurchDetailPage churchId={churchId} initialTab={tab} />
    </PermissionGuard>
  );
}
