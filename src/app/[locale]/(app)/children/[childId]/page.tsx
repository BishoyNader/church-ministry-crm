import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PermissionGuard } from "@/features/rbac";
import { ChildDetailPage } from "@/features/children";

export const dynamic = "force-dynamic";

export default async function ChildDetailRoute({
  params,
}: {
  params: Promise<{ locale: string; childId: string }>;
}) {
  const { locale, childId } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  return (
    <PermissionGuard permission="beneficiaries.read">
      <ChildDetailPage childId={childId} />
    </PermissionGuard>
  );
}
