"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useRoles, useStages, useRejectServant } from "@/features/users";
import { useApproveServantWithProvision } from "../hooks/use-approval-center";
import type { PendingRegistration } from "@/features/users/services/approval.service";

type ApprovalDetailDrawerProps = {
  registration: PendingRegistration | null;
  onClose: () => void;
};

export function ApprovalDetailDrawer({ registration, onClose }: ApprovalDetailDrawerProps) {
  const t = useTranslations("approvals.drawer");

  const rolesQuery = useRoles(registration?.church_id ?? null);
  const stagesQuery = useStages(registration?.church_id ?? null);
  const provisionMutation = useApproveServantWithProvision();
  const rejectMutation = useRejectServant();

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleTouched, setRoleTouched] = useState(false);
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>([]);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const roles = rolesQuery.data?.data ?? [];
  const stages = stagesQuery.data?.data ?? [];
  const servantRole = roles.find((role) => role.role_type === "servant");

  const toggleRole = (roleId: string) => {
    setRoleTouched(true);
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

  const toggleStage = (stageId: string) => {
    setSelectedStageIds((prev) =>
      prev.includes(stageId) ? prev.filter((id) => id !== stageId) : [...prev, stageId],
    );
  };

  const handleApprove = async () => {
    if (!registration) return;
    setActionError(null);

    const defaultRoleIds = servantRole ? [servantRole.id] : [];
    const customized =
      roleTouched &&
      [...selectedRoleIds].sort().join(",") !== [...defaultRoleIds].sort().join(",");

    const result = await provisionMutation.mutateAsync({
      servantId: registration.id,
      roleIds: customized ? selectedRoleIds : [],
      stageIds: selectedStageIds,
    });

    if (!result.success) {
      setActionError(result.message ?? t("errors.general"));
      return;
    }

    onClose();
  };

  const handleReject = async () => {
    if (!registration) return;
    setActionError(null);

    const result = await rejectMutation.mutateAsync({
      servantId: registration.id,
      reason: rejectReason.trim() || undefined,
    });

    if (!result.success) {
      setActionError(result.message ?? t("errors.general"));
      return;
    }

    onClose();
  };

  return (
    <Sheet
      open={!!registration}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {(registration?.profiles?.full_name_ar ?? registration?.profiles?.email ?? "?")[0]}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">
                {registration?.profiles?.full_name_ar ?? "—"}
              </SheetTitle>
              <SheetDescription className="truncate">
                {registration?.profiles?.email ?? "—"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("email")}</dt>
              <dd className="text-end">{registration?.profiles?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("phone")}</dt>
              <dd className="text-end">{registration?.profiles?.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("requestedOn")}</dt>
              <dd className="text-end">
                {registration
                  ? new Date(registration.created_at).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
          </dl>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">{t("rolesTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("rolesHint")}</p>
            </div>
            {rolesQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("rolesEmpty")}</p>
            ) : (
              <div className="space-y-2">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <Checkbox
                      checked={
                        selectedRoleIds.includes(role.id) ||
                        (!roleTouched && servantRole?.id === role.id)
                      }
                      onCheckedChange={() => toggleRole(role.id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{role.name_ar}</p>
                      {role.name_en ? (
                        <p className="truncate text-xs text-muted-foreground">{role.name_en}</p>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">{t("stagesTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("stagesHint")}</p>
            </div>
            {stagesQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("stagesEmpty")}</p>
            ) : (
              <div className="space-y-2">
                {stages.map((stage) => (
                  <label
                    key={stage.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <Checkbox
                      checked={selectedStageIds.includes(stage.id)}
                      onCheckedChange={() => toggleStage(stage.id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{stage.name_ar}</p>
                      {stage.name_en ? (
                        <p className="truncate text-xs text-muted-foreground">{stage.name_en}</p>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          {actionError ? (
            <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}

          {showRejectReason ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                {t("rejectReasonLabel")}
                <Input
                  className="mt-2"
                  placeholder={t("rejectReasonPlaceholder")}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleReject}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="size-4" />
                  {rejectMutation.isPending ? t("rejecting") : t("confirmReject")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectReason(false);
                    setRejectReason("");
                  }}
                >
                  {t("cancelReject")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowRejectReason(true)}
                disabled={provisionMutation.isPending}
              >
                <XCircle className="size-4 text-destructive" />
                {t("reject")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleApprove}
                disabled={provisionMutation.isPending || rejectMutation.isPending}
              >
                <CheckCircle2 className="size-4" />
                {provisionMutation.isPending ? t("approving") : t("approve")}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
