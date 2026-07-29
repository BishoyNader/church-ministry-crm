"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Pencil, Ban } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGuard } from "@/features/rbac";
import { useChildDetail } from "../hooks/use-children";
import { ChildDetailTabs } from "./child-detail-tabs";
import { ChildFormDialog } from "./child-form-dialog";
import { ChildDeleteDialog } from "./child-delete-dialog";
import { ChildEmptyState } from "./child-empty-state";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "destructive",
  transferred: "secondary",
  graduated: "outline",
};

const PIPELINE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new_visitor: "outline",
  first_followup: "secondary",
  regular_attendee: "default",
  active_member: "default",
  leader_candidate: "secondary",
};

type ChildDetailPageProps = {
  childId: string;
};

export function ChildDetailPage({ childId }: ChildDetailPageProps) {
  const t = useTranslations("children.detail");
  const tStatus = useTranslations("children.status");
  const tPipeline = useTranslations("children.pipeline");
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

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
        <ChildEmptyState
          title={t("notFound")}
          description=""
        />
      </section>
    );
  }

  const childName = `${child.first_name_ar} ${child.last_name_ar}`;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/children")}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {childName}
          </h1>
          <Badge variant={STATUS_VARIANT[child.status] ?? "secondary"}>
            {tStatus(child.status)}
          </Badge>
          <Badge variant={PIPELINE_VARIANT[child.pipeline_stage] ?? "secondary"}>
            {tPipeline(child.pipeline_stage)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGuard permission="children.update">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              {t("editChild")}
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="children.delete">
            <Button variant="outline" onClick={() => setDeactivateOpen(true)}>
              <Ban className="size-4" />
              {t("deactivateChild")}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <ChildDetailTabs child={child} />

      {editOpen && (
        <ChildFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          child={child}
        />
      )}

      {deactivateOpen && (
        <ChildDeleteDialog
          open={deactivateOpen}
          onOpenChange={setDeactivateOpen}
          child={child}
        />
      )}
    </section>
  );
}
