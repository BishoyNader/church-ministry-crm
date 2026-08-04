"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, UserRoundCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/layout/section-card";
import {
  usePendingRegistrations,
  useApproveServant,
  useRejectServant,
} from "../hooks/use-approvals";
import { EmptyState } from "@/components/feedback/empty-state";
import type { PendingRegistration } from "../services/approval.service";

export function PendingRegistrationsQueue() {
  const t = useTranslations("users.approvalQueue");
  const { data, isLoading } = usePendingRegistrations();
  const approveMutation = useApproveServant();
  const rejectMutation = useRejectServant();

  const [rejectTarget, setRejectTarget] = useState<PendingRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const registrations = data?.data ?? [];

  const handleApprove = async (registration: PendingRegistration) => {
    setApproveError(null);
    const result = await approveMutation.mutateAsync(registration.id);
    if (!result.success) {
      setApproveError(result.message ?? t("errors.general"));
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejectError(null);
    const result = await rejectMutation.mutateAsync({
      servantId: rejectTarget.id,
      reason: rejectReason.trim() || undefined,
    });
    if (!result.success) {
      setRejectError(result.message ?? t("errors.general"));
      return;
    }
    setRejectTarget(null);
    setRejectReason("");
  };

  if (isLoading) {
    return (
      <SectionCard className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </SectionCard>
    );
  }

  if (registrations.length === 0) {
    return (
      <SectionCard className="p-6">
        <EmptyState
          icon={<UserRoundCheck className="size-6 text-muted-foreground" />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between px-6 pt-5">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Badge variant="secondary">{registrations.length}</Badge>
      </div>

      {approveError ? (
        <div className="mx-6 mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {approveError}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("table.caption")}</caption>
          <thead>
            <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-6 py-3">{t("table.applicant")}</th>
              <th scope="col" className="px-4 py-3">{t("table.email")}</th>
              <th scope="col" className="px-4 py-3">{t("table.phone")}</th>
              <th scope="col" className="px-4 py-3">{t("table.requestedOn")}</th>
              <th scope="col" className="px-6 py-3 text-end">{t("table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((registration) => (
              <tr key={registration.id} className="border-b transition hover:bg-muted/30">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {(registration.profiles?.full_name_ar ?? registration.profiles?.email ?? "?")[0]}
                    </div>
                    <div>
                      <p className="font-medium">
                        {registration.profiles?.full_name_ar ?? "—"}
                      </p>
                      {registration.profiles?.full_name_en ? (
                        <p className="text-xs text-muted-foreground">
                          {registration.profiles.full_name_en}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {registration.profiles?.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {registration.profiles?.phone ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(registration.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-3 text-end">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApprove(registration)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <CheckCircle2 className="size-4 text-success" />
                      {t("approve")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRejectTarget(registration)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <XCircle className="size-4 text-destructive" />
                      {t("reject")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{t("rejectDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("rejectDialog.description", {
                name: rejectTarget?.profiles?.full_name_ar ?? "",
              })}
            </DialogDescription>
          </DialogHeader>

          {rejectError ? (
            <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {rejectError}
            </div>
          ) : null}

          <label className="block text-sm font-medium">
            {t("rejectDialog.reasonLabel")}
            <Input
              className="mt-2"
              placeholder={t("rejectDialog.reasonPlaceholder")}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </label>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("rejectDialog.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? t("rejectDialog.processing") : t("rejectDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </SectionCard>
  );
}
