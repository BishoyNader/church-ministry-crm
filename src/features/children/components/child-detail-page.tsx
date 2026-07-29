"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Pencil } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGuard } from "@/features/rbac";
import { useChildDetail } from "../hooks/use-children";
import { ChildDetailTabs } from "./child-detail-tabs";
import { ChildFormDialog } from "./child-form-dialog";

type ChildDetailPageProps = {
  childId: string;
};

export function ChildDetailPage({ childId }: ChildDetailPageProps) {
  const t = useTranslations("children.detail");
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, error } = useChildDetail(childId);
  const child = data?.data;

  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </section>
    );
  }

  if (error || !child) {
    return (
      <section className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/children")}>
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Button>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Child not found.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/children")}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {child.first_name_ar} {child.last_name_ar}
          </h1>
        </div>
        <PermissionGuard permission="children.update">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            {t("editChild")}
          </Button>
        </PermissionGuard>
      </div>

      <ChildDetailTabs child={child} />

      {editOpen && (
        <ChildFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          child={child}
        />
      )}
    </section>
  );
}
