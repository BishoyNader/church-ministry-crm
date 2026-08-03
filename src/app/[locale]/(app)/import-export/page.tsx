import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PermissionGuard } from "@/features/rbac";
import { ImportExportPage } from "@/features/import-export";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ImportExportRoute({
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
    <PermissionGuard permission="import.execute">
      <ImportExportPage />
    </PermissionGuard>
  );
}