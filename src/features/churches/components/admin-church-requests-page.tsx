"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Church as ChurchIcon, Link2, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  useChurchRequests,
  useApproveChurchRequest,
  useRejectChurchRequest,
} from "../hooks/use-church-requests";
import type {
  ChurchRequestRow,
  ChurchRequestStatus,
} from "../types/church-request.admin.types";

type ApprovalResult =
  | { ok: true; inviteLink: string | null }
  | { ok: false; message: string };

const STATUS_TABS: { value: ChurchRequestStatus; labelKey: string }[] = [
  { value: "pending", labelKey: "tabs.pending" },
  { value: "approved", labelKey: "tabs.approved" },
  { value: "rejected", labelKey: "tabs.rejected" },
];

export function AdminChurchRequestsPage() {
  const t = useTranslations("admin.churchRequests");
  const [status, setStatus] = useState<ChurchRequestStatus>("pending");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useChurchRequests(status);
  const approveMutation = useApproveChurchRequest();
  const rejectMutation = useRejectChurchRequest();

  const [rejectTarget, setRejectTarget] = useState<ChurchRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveResult, setApproveResult] = useState<ApprovalResult | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return data?.data ?? [];
    return (data?.data ?? []).filter((request) =>
      [
        request.church_name_ar,
        request.catechist_name,
        request.applicant_name,
        request.email,
        request.phone ?? "",
      ].some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }, [data, search]);

  const handleApprove = async (request: ChurchRequestRow) => {
    const result = await approveMutation.mutateAsync(request.id);
    if (result.success) {
      setApproveResult({ ok: true, inviteLink: result.data?.inviteLink ?? null });
    } else {
      setApproveResult({ ok: false, message: result.message ?? t("errors.general") });
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejectError(null);
    const result = await rejectMutation.mutateAsync({
      requestId: rejectTarget.id,
      reason: rejectReason.trim() || undefined,
    });
    if (!result.success) {
      setRejectError(result.message ?? t("errors.general"));
      return;
    }
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <section className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs
        value={status}
        onValueChange={(value) => setStatus(value as ChurchRequestStatus)}
      >
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={status}>
          <SectionCard className="overflow-hidden">
            <div className="border-b border-border-whisper p-4 sm:p-6">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  role="searchbox"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchLabel")}
                  className="ps-9"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                {t("resultsCount", { count: filteredRequests.length })}
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<ChurchIcon className="size-6 text-muted-foreground" />}
                  title={search ? t("empty.searchTitle") : t("empty.title")}
                  description={search ? t("empty.searchDescription") : t("empty.description")}
                />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredRequests.map((request) => (
                  <div key={request.id} className="p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">
                            {request.church_name_ar}
                          </h3>
                          {request.status === "pending" ? (
                            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                              {t("tabs.pending")}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t("table.catechist", { name: request.catechist_name })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {request.applicant_name} — {request.email}
                          {request.phone ? ` · ${request.phone}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("table.submitted", {
                            date: new Date(request.created_at).toLocaleDateString(),
                          })}
                        </p>
                        {request.decision_notes ? (
                          <p className="mt-1 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                            {t("table.reason", { reason: request.decision_notes })}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {request.status === "pending" ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(request)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                            >
                              <CheckCircle2 className="size-4 text-success" />
                              {t("approve")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRejectTarget(request)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                            >
                              <XCircle className="size-4 text-danger" />
                              {t("reject")}
                            </Button>
                          </>
                        ) : (
                          <Badge variant={request.status === "approved" ? "default" : "destructive"}>
                            {request.status === "approved" ? t("tabs.approved") : t("tabs.rejected")}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {request.notes ? (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-primary">
                          {t("table.notes")}
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                          {request.notes}
                        </p>
                      </details>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

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
                name: rejectTarget?.church_name_ar ?? "",
              })}
            </DialogDescription>
          </DialogHeader>

          {rejectError ? (
            <div role="alert" className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {rejectError}
            </div>
          ) : null}

          <label className="block text-sm font-medium">
            {t("rejectDialog.reasonLabel")}
            <Textarea
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

      <Dialog
        open={!!approveResult}
        onOpenChange={(open) => {
          if (!open) setApproveResult(null);
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {approveResult?.ok ? t("approveDialog.successTitle") : t("approveDialog.errorTitle")}
            </DialogTitle>
            <DialogDescription>
              {approveResult?.ok ? t("approveDialog.successDescription") : approveResult?.message}
            </DialogDescription>
          </DialogHeader>

          {approveResult?.ok && approveResult.inviteLink ? (
            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3">
              <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <code className="break-all text-xs text-muted-foreground">
                {approveResult.inviteLink}
              </code>
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {approveResult?.ok ? t("approveDialog.close") : t("approveDialog.closeError")}
            </DialogClose>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
