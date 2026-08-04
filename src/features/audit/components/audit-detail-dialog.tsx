"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AuditLogEntry } from "../types/audit.types";

type AuditDetailDialogProps = {
  entry: AuditLogEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const hasValue = value !== null && value !== undefined && value !== "";
  if (!hasValue) return null;

  let rendered: string;
  try {
    rendered =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    rendered = String(value);
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
        {rendered}
      </pre>
    </div>
  );
}

export function AuditDetailDialog({ entry, open, onOpenChange }: AuditDetailDialogProps) {
  const t = useTranslations("audit");
  const locale = useLocale();

  const actorLabel = entry.actorName ?? entry.actorEmail ?? entry.actorId;
  const formattedTime = new Date(entry.createdAt).toLocaleString(locale);
  const hasChanges = entry.oldValues !== null || entry.newValues !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("detail.title")}</DialogTitle>
          <DialogDescription>
            {formattedTime}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{t(`actions.${entry.action}`, { defaultValue: entry.action })}</Badge>
            <Badge variant="secondary">
              {t(`entityTypes.${entry.entityType}`, { defaultValue: entry.entityType })}
            </Badge>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.entityId")}
              </dt>
              <dd className="mt-1 font-mono text-xs break-all">{entry.entityId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.actor")}
              </dt>
              <dd className="mt-1">{actorLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.action")}
              </dt>
              <dd className="mt-1">{t(`actions.${entry.action}`, { defaultValue: entry.action })}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.entityType")}
              </dt>
              <dd className="mt-1">
                {t(`entityTypes.${entry.entityType}`, { defaultValue: entry.entityType })}
              </dd>
            </div>
          </dl>

          {hasChanges ? (
            <div className="space-y-4">
              <JsonBlock label={t("detail.oldValues")} value={entry.oldValues} />
              <JsonBlock label={t("detail.newValues")} value={entry.newValues} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("detail.noChanges")}</p>
          )}

          <JsonBlock label={t("detail.metadata")} value={entry.metadata} />
        </div>

        <DialogClose render={<Button variant="outline" />}>
          {t("detail.close")}
        </DialogClose>
      </DialogPopup>
    </Dialog>
  );
}
