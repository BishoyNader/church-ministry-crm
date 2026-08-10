import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PermissionGuard } from "@/features/rbac";
import { EventsPage } from "@/features/events";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function EventsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ serviceId?: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  const { serviceId } = await searchParams;

  return (
    <PermissionGuard permission="events.read">
      <EventsPage presetServiceId={serviceId} />
    </PermissionGuard>
  );
}
