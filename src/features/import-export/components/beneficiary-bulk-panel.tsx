"use client";

import { useTranslations } from "next-intl";
import { SectionCard } from "@/components/layout/section-card";
import { ImportUploadArea } from "./import-upload-area";
import { ExportActions } from "./export-actions";
import type { BeneficiaryExportFilters } from "../types/import-export.types";

/**
 * Bulk import/export surface for beneficiaries (children).
 * - Church-scoped users omit `churchId` (resolved from their own profile).
 * - The Platform Owner passes an explicit `churchId` to target a tenant.
 * - `filters` carry the current children page search/service/stage/status so the
 *   exported file honours what the operator is looking at.
 */
export function BeneficiaryBulkPanel({
  churchId,
  filters,
}: {
  churchId?: string;
  filters?: BeneficiaryExportFilters;
}) {
  const t = useTranslations("importExport");

  return (
    <SectionCard>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("children.bulk.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("children.bulk.description")}</p>
          </div>
        </div>
        <div className="mt-6 space-y-8">
          <ImportUploadArea churchId={churchId} />
          <ExportActions
            churchId={churchId}
            filters={filters}
            entities={["beneficiaries"]}
          />
        </div>
      </div>
    </SectionCard>
  );
}
