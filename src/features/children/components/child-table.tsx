"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { PermissionGuard } from "@/features/rbac";
import type { ChildListItem } from "../types/child.types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "destructive",
  transferred: "secondary",
  graduated: "outline",
};

type ChildTableProps = {
  children_: ChildListItem[];
  isLoading: boolean;
  onEdit: (child: ChildListItem) => void;
  onDelete: (child: ChildListItem) => void;
};

export function ChildTable({ children_, isLoading, onEdit, onDelete }: ChildTableProps) {
  const t = useTranslations("children");
  const router = useRouter();

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{t("table.name")}</th>
              <th className="px-4 py-3">{t("table.stage")}</th>
              <th className="px-4 py-3">{t("table.status")}</th>
              <th className="px-4 py-3">{t("table.mobile")}</th>
              <th className="px-4 py-3 text-end">{t("table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-20 ms-auto" /></td>
                  </tr>
                ))
              : children_.map((child) => (
                  <tr key={child.id} className="border-b transition hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {child.full_name_ar[0]}
                        </div>
                        <div>
                          <p className="font-medium">{child.full_name_ar}</p>
                          {child.full_name_en ? (
                            <p className="text-xs text-muted-foreground">{child.full_name_en}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{child.stageNameAr}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[child.status] ?? "secondary"}>
                        {t(`status.${child.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {child.mobile ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => router.push(`/children/${child.id}`)}
                          aria-label={t("table.actions")}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <PermissionGuard permission="beneficiaries.update">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onEdit(child)}
                            aria-label={t("table.actions")}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="beneficiaries.delete">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onDelete(child)}
                            aria-label={t("table.actions")}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                ))}
            {!isLoading && children_.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  {t("emptyState.title")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
