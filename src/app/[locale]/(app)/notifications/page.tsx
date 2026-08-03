import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PermissionGuard } from "@/features/rbac";
import { NotificationCenterPage } from "@/features/notifications/components/notification-center-page";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function NotificationsRoute({
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
    <PermissionGuard permission="notifications.read">
      <NotificationCenterPage />
    </PermissionGuard>
  );
}
