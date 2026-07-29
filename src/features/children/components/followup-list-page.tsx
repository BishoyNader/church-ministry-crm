"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { PermissionGuard } from "@/features/rbac";
import { useFollowupList, useDeleteFollowup } from "../hooks/use-followups";
import { listUsersAction } from "../actions/child.actions";
import { ChildEmptyState } from "./child-empty-state";
import { FollowupFormDialog } from "./followup-form-dialog";
import { FollowupStatusDialog } from "./followup-status-dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import type { FollowupListItem } from "../types/child.types";

const STATUS_OPTIONS = ["scheduled", "in_progress", "completed", "cancelled"] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "outline",
  in_progress: "secondary",
  completed: "default",
  cancelled: "destructive",
};

const TYPE_OPTIONS = ["phone_call", "home_visit", "whatsapp", "church_meeting", "other"] as const;

export function FollowupListPage() {
  const t = useTranslations("children");
  const tDetail = useTranslations("children.detail");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [users, setUsers] = useState<Array<{ id: string; full_name_ar: string }>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState<FollowupListItem | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusEditingFollowup, setStatusEditingFollowup] = useState<FollowupListItem | null>(null);

  const { data, isLoading, error } = useFollowupList({
    status: statusFilter !== "all" ? statusFilter : undefined,
    assigned_to: assignedToFilter !== "all" ? assignedToFilter : undefined,
  });

  const deleteMutation = useDeleteFollowup();

  const handleDelete = useCallback(
    (followupId: string) => {
      if (confirm(t("followups.deleteConfirm"))) {
        deleteMutation.mutate(followupId);
      }
    },
    [deleteMutation, t],
  );

  useEffect(() => {
    listUsersAction().then((result) => {
      if (result.success && result.data) {
        setUsers(result.data);
      }
    });
  }, []);

  const followups = useMemo(() => {
    const source = data?.data ?? [];
    let filtered = source;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.childFirstNameAr?.toLowerCase().includes(q) ||
          f.childLastNameAr?.toLowerCase().includes(q),
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((f) => f.type === typeFilter);
    }

    return filtered;
  }, [data?.data, search, typeFilter]);

  const handleOpenCreate = useCallback(() => {
    setEditingFollowup(null);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((followup: FollowupListItem) => {
    setEditingFollowup(followup);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingFollowup(null);
    }
  }, []);

  const handleOpenStatusDialog = useCallback((followup: FollowupListItem) => {
    setStatusEditingFollowup(followup);
    setStatusDialogOpen(true);
  }, []);

  const handleStatusDialogClose = useCallback((open: boolean) => {
    setStatusDialogOpen(open);
    if (!open) {
      setStatusEditingFollowup(null);
    }
  }, []);

  const STATUS_FILTER_OPTIONS = [
    { value: "all", labelKey: "filters.allStatuses" },
    ...STATUS_OPTIONS.map((s) => ({ value: s, labelKey: `detail.followupStatus.${s}` })),
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("followups.title")}
        description={t("followups.description")}
        actions={
          <PermissionGuard permission="followups.create">
            <Button onClick={handleOpenCreate}>
              <Plus className="size-4" />
              {t("followups.addFollowup")}
            </Button>
          </PermissionGuard>
        }
      />

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <Input
            placeholder={t("followups.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px]"
          />

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as string)}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={t("filters.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.value === "all"
                    ? t(opt.labelKey)
                    : tDetail(opt.labelKey.replace("detail.", ""))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as string)}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={t("followups.allTypes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("followups.allTypes")}</SelectItem>
              {TYPE_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>
                  {tDetail(`followupType.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={assignedToFilter}
            onValueChange={(value) => setAssignedToFilter(value as string)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("followups.allAssignedTo")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("followups.allAssignedTo")}</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {error ? (
        <ErrorState title={t("followups.loadError")} message={error.message} />
      ) : isLoading ? (
        <SectionCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">{t("followups.child")}</th>
                  <th className="px-4 py-3">{t("followups.type")}</th>
                  <th className="px-4 py-3">{t("followups.status")}</th>
                  <th className="px-4 py-3">{t("followups.scheduledAt")}</th>
                  <th className="px-4 py-3">{t("followups.assignedTo")}</th>
                  <th className="px-4 py-3 text-end">{t("followups.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-20 ms-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : followups.length === 0 ? (
        <ChildEmptyState
          title={t("followups.noFollowups")}
          description=""
        />
      ) : (
        <SectionCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">{t("followups.child")}</th>
                  <th className="px-4 py-3">{t("followups.type")}</th>
                  <th className="px-4 py-3">{t("followups.status")}</th>
                  <th className="px-4 py-3">{t("followups.scheduledAt")}</th>
                  <th className="px-4 py-3">{t("followups.assignedTo")}</th>
                  <th className="px-4 py-3 text-end">{t("followups.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {followups.map((followup) => (
                  <tr key={followup.id} className="border-b transition hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {followup.childFirstNameAr[0]}
                        </div>
                        <div>
                          <p className="font-medium">
                            {followup.childFirstNameAr} {followup.childLastNameAr}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {followup.type ? tDetail(`followupType.${followup.type}`) : "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={STATUS_VARIANT[followup.status] ?? "secondary"}
                      >
                        {tDetail(`followupStatus.${followup.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {followup.scheduled_at
                        ? new Date(followup.scheduled_at).toLocaleDateString()
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {followup.assignedToNameAr ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <PermissionGuard permission="followups.update">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenStatusDialog(followup)}
                            aria-label={t("followups.changeStatus")}
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="followups.update">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("followups.edit")}
                            onClick={() => handleOpenEdit(followup)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="followups.delete">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("followups.delete")}
                            onClick={() => handleDelete(followup.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <FollowupFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        followup={editingFollowup}
      />

      <FollowupStatusDialog
        open={statusDialogOpen}
        onOpenChange={handleStatusDialogClose}
        followup={statusEditingFollowup}
      />
    </section>
  );
}
