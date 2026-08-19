"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Search, Pencil, ListChecks, Archive, CheckCircle2, XCircle } from "lucide-react";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineNotice } from "@/components/ui/inline-notice";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { ErrorState } from "@/components/feedback/error-state";
import { useAccessState } from "@/features/rbac";
import { formatLocalizedDate } from "@/lib/dates";
import {
  useServantList,
  useApproveServant,
  useRejectServant,
  useArchiveServant,
} from "../hooks/use-servants";
import { ServantEditDialog } from "./servant-edit-dialog";
import { ServantAssignmentDialog } from "./servant-assignment-dialog";
import { ServantCreateDialog } from "./servant-create-dialog";
import type { ServantListItem } from "../types/servant.types";

const APPROVAL_FILTER_OPTIONS = [
  { value: "all", labelKey: "approvalFilter.all" },
  { value: "pending", labelKey: "approvalFilter.pending" },
  { value: "approved", labelKey: "approvalFilter.approved" },
  { value: "rejected", labelKey: "approvalFilter.rejected" },
] as const;

const PAGE_SIZE = 20;

export function ServantListPage() {
  const t = useTranslations("servants");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<string>("all");

  const [editServant, setEditServant] = useState<ServantListItem | null>(null);
  const [assignServant, setAssignServant] = useState<ServantListItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ServantListItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ServantListItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [approveError, setApproveError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const { data, isLoading, error } = useServantList({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    approvalStatus: approvalFilter !== "all" ? approvalFilter : undefined,
  });

  const approveMutation = useApproveServant();
  const rejectMutation = useRejectServant();
  const archiveMutation = useArchiveServant();

  const { data: accessState } = useAccessState();
  const permissionCodes = new Set(
    (accessState?.permissions ?? []).map((permission) => permission.code),
  );
  const isSuperAdmin = (accessState?.roles ?? []).some(
    (role) => role.role_type === "super_admin",
  );

  const canApprove = permissionCodes.has("servants.approve");
  const canAssign = permissionCodes.has("servants.assign");
  const canEdit = isSuperAdmin && permissionCodes.has("servants.update");
  const canArchive = isSuperAdmin && permissionCodes.has("servants.delete");
  const canCreate = isSuperAdmin && permissionCodes.has("servants.create");

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleApprove = async (servant: ServantListItem) => {
    setApproveError(null);
    const result = await approveMutation.mutateAsync(servant.id);
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

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setArchiveError(null);
    const result = await archiveMutation.mutateAsync(archiveTarget.id);
    if (!result.success) {
      setArchiveError(result.message ?? t("errors.general"));
      return;
    }
    setArchiveTarget(null);
  };

  const servants = data?.data?.servants ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const approvalBadgeVariant = (status: string) =>
    status === "approved"
      ? "default"
      : status === "rejected"
        ? "destructive"
        : "secondary";

  const stageNames = (servant: ServantListItem) =>
    servant.stageAssignments
      .map((assignment) => assignment.stages?.name_ar ?? "")
      .filter(Boolean);

  if (error) {
    return <ErrorState title={t("errors.general")} message={error.message} />;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("create")}
            </Button>
          ) : undefined
        }
      />

      {approveError ? (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {approveError}
        </div>
      ) : null}

      <SectionCard className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              aria-label={t("search")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="ps-9"
            />
          </div>
          <Button variant="outline" onClick={handleSearch} className="sm:flex-shrink-0">
            {t("search")}
          </Button>
          <Select
            value={approvalFilter}
            onValueChange={(value) => {
              setApprovalFilter(value as string);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPROVAL_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("table.caption")}</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 sm:px-4 py-3">{t("table.name")}</th>
                <th scope="col" className="px-3 sm:px-4 py-3 hidden lg:table-cell">{t("table.email")}</th>
                <th scope="col" className="px-3 sm:px-4 py-3 hidden sm:table-cell">{t("table.roles")}</th>
                <th scope="col" className="px-3 sm:px-4 py-3 hidden md:table-cell">{t("table.stages")}</th>
                <th scope="col" className="px-3 sm:px-4 py-3">{t("table.approval")}</th>
                <th scope="col" className="px-3 sm:px-4 py-3 hidden lg:table-cell">{t("table.joined")}</th>
                <th scope="col" className="px-3 sm:px-4 py-3 text-end">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 sm:px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-3 sm:px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-3 sm:px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-24" /></td>
                      <td className="px-3 sm:px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-24" /></td>
                      <td className="px-3 sm:px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                      <td className="px-3 sm:px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 sm:px-4 py-3"><Skeleton className="h-8 w-28 ms-auto" /></td>
                    </tr>
                  ))
                : servants.map((servant) => {
                    const stages = stageNames(servant);
                    const isPending = servant.approval_status === "pending";

                    return (
                      <tr key={servant.id} className="border-b transition-colors hover:bg-muted/30">
                        <td className="px-3 sm:px-4 py-3">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {(servant.profile?.full_name_ar ?? servant.profile?.email ?? "?")[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {servant.profile?.full_name_ar ?? "—"}
                              </p>
                              {servant.profile?.full_name_en ? (
                                <p className="text-xs text-muted-foreground truncate">
                                  {servant.profile.full_name_en}
                                </p>
                              ) : null}
                              <p className="text-xs text-muted-foreground truncate lg:hidden">
                                {servant.profile?.email ?? ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-muted-foreground hidden lg:table-cell">
                          <span className="truncate block max-w-[200px]">{servant.profile?.email ?? "—"}</span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {servant.roles.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              servant.roles.slice(0, 2).map((role) => (
                                <Badge key={role.id} variant="outline" className="text-xs">
                                  {role.name_ar}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {stages.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <>
                                {stages.slice(0, 2).map((stage) => (
                                  <Badge key={stage} variant="secondary" className="text-xs">
                                    {stage}
                                  </Badge>
                                ))}
                                {stages.length > 2 ? (
                                  <Badge variant="outline" className="text-xs">
                                    +{stages.length - 2}
                                  </Badge>
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <Badge variant={approvalBadgeVariant(servant.approval_status)}>
                            {t(`status.${servant.approval_status}`)}
                          </Badge>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-muted-foreground hidden lg:table-cell">
                          {formatLocalizedDate(servant.created_at, locale)}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-end">
                          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                            {isPending && canApprove ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleApprove(servant)}
                                  disabled={approveMutation.isPending || rejectMutation.isPending}
                                >
                                  <CheckCircle2 className="size-4 text-success" />
                                  <span className="hidden sm:inline">{t("approve")}</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setRejectTarget(servant)}
                                  disabled={approveMutation.isPending || rejectMutation.isPending}
                                >
                                  <XCircle className="size-4 text-destructive" />
                                  <span className="hidden sm:inline">{t("reject")}</span>
                                </Button>
                              </>
                            ) : null}

                            {canEdit ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setEditServant(servant)}
                                aria-label={t("actions.edit")}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            ) : null}

                            {canAssign ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setAssignServant(servant)}
                                aria-label={t("actions.assign")}
                              >
                                <ListChecks className="size-4" />
                              </Button>
                            ) : null}

                            {canArchive ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setArchiveTarget(servant)}
                                aria-label={t("actions.archive")}
                              >
                                <Archive className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

              {!isLoading && servants.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {t("emptyState")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t px-0">
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </SectionCard>

      {editServant ? (
        <ServantEditDialog
          open={!!editServant}
          onOpenChange={(open) => {
            if (!open) setEditServant(null);
          }}
          servant={editServant}
        />
      ) : null}

      {assignServant ? (
        <ServantAssignmentDialog
          open={!!assignServant}
          onOpenChange={(open) => {
            if (!open) setAssignServant(null);
          }}
          servant={assignServant}
        />
      ) : null}

      <ServantCreateDialog open={createOpen} onOpenChange={setCreateOpen} />

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
                name: rejectTarget?.profile?.full_name_ar ?? "",
              })}
            </DialogDescription>
          </DialogHeader>

          {rejectError ? (
            <InlineNotice variant="error">
              <p>{rejectError}</p>
            </InlineNotice>
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

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title={t("archiveDialog.title")}
        description={t("archiveDialog.description", {
          name: archiveTarget?.profile?.full_name_ar ?? "",
        })}
        confirmLabel={t("archiveDialog.confirm")}
        cancelLabel={t("archiveDialog.cancel")}
        processingLabel={t("archiveDialog.processing")}
        destructive
        isSubmitting={archiveMutation.isPending}
        errorMessage={archiveError}
        onConfirm={handleArchive}
      />
    </section>
  );
}
