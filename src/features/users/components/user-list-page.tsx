"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, Plus, Download, Loader2, Layers, Pencil, UserCog, UserX } from "lucide-react";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { PermissionGuard } from "@/features/rbac";
import { formatLocalizedDate } from "@/lib/dates";
import { useUserList, useDeactivateUser, useActorChurch, useExportUsers } from "../hooks/use-users";
import { PendingRegistrationsQueue } from "./pending-registrations-queue";
import { UserForm } from "./user-form";
import { UserRoleAssignment } from "./user-role-assignment";
import { UserAssignmentsDialog } from "./user-assignments-dialog";
import { ChurchScopeSelector } from "./church-scope-selector";
import { UserImportPanel } from "./user-import-panel";
import type { UserListItem } from "../types/user.types";

const ROLE_FILTER_OPTIONS = [
  { value: "all", labelKey: "roleFilter.all" },
  { value: "super_admin", labelKey: "roleFilter.superAdmin" },
  { value: "admin", labelKey: "roleFilter.admin" },
  { value: "stage_manager", labelKey: "roleFilter.stageManager" },
  { value: "servant", labelKey: "roleFilter.servant" },
] as const;

const PAGE_SIZE = 20;

export function UserListPage() {
  const t = useTranslations("users");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [rolesUser, setRolesUser] = useState<UserListItem | null>(null);
  const [stagesUser, setStagesUser] = useState<UserListItem | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserListItem | null>(null);
  const [scopeChurchId, setScopeChurchId] = useState<string | null>(null);

  const actorChurchQuery = useActorChurch();
  const isPlatformOwner = actorChurchQuery.data?.isPlatformOwner ?? false;

  const { data, isLoading, error } = useUserList({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    roleFilter: roleFilter !== "all" ? roleFilter : undefined,
    churchId: scopeChurchId ?? undefined,
    enabled: !isPlatformOwner || !!scopeChurchId,
  });

  const deactivateMutation = useDeactivateUser();
  const exportMutation = useExportUsers();
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const triggerDownload = (fileName: string, content: string, mimeType: string) => {
    const isBase64 = mimeType.includes("spreadsheetml");
    const blob = isBase64
      ? new Blob([Uint8Array.from(atob(content), (char) => char.charCodeAt(0))], { type: mimeType })
      : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExportError(null);
    const result = await exportMutation.mutateAsync({
      format: exportFormat,
      search: search || undefined,
      roleFilter: roleFilter !== "all" ? roleFilter : undefined,
      churchId: scopeChurchId ?? undefined,
    });

    if (!result.success || !result.data) {
      setExportError(result.message ?? t("export.error"));
      return;
    }

    triggerDownload(result.data.fileName, result.data.content, result.data.mimeType);
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    const result = await deactivateMutation.mutateAsync({
      userId: deactivateUser.id,
      churchId: scopeChurchId ?? undefined,
    });
    if (result.success) setDeactivateUser(null);
  };

  const users = data?.data?.users ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (error) {
    return <ErrorState title={t("errors.listFailed")} message={error.message} />;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("createUser")}
          </Button>
        }
      />

      <ChurchScopeSelector
        value={scopeChurchId ?? ""}
        onChange={(churchId) => {
          setScopeChurchId(churchId);
          setPage(1);
        }}
      />

      <PermissionGuard permission="servants.approve">
        <PendingRegistrationsQueue />
      </PermissionGuard>

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              aria-label={t("search")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleSearch}>
            {t("search")}
          </Button>
          <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val as string); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={exportFormat} onValueChange={(val) => setExportFormat(val as "csv" | "xlsx")}>
            <SelectTrigger className="w-full sm:w-28" aria-label={t("export.formatLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="xlsx">XLSX</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exportMutation.isPending || (isPlatformOwner && scopeChurchId === null)}
            className="gap-2"
          >
            {exportMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t("export.button")}
          </Button>
        </div>
        {exportError ? (
          <p className="mt-3 text-sm text-destructive">{exportError}</p>
        ) : null}
      </SectionCard>

      <UserImportPanel churchId={scopeChurchId} />

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("table.caption")}</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-3">{t("table.name")}</th>
                <th scope="col" className="px-4 py-3">{t("table.email")}</th>
                <th scope="col" className="px-4 py-3">{t("table.roles")}</th>
                <th scope="col" className="px-4 py-3">{t("table.status")}</th>
                <th scope="col" className="px-4 py-3">{t("table.joined")}</th>
                <th scope="col" className="px-4 py-3 text-end">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-8 w-8 ms-auto" /></td>
                    </tr>
                  ))
                : users.map((user) => (
                    <tr key={user.id} className="border-b transition hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {(user.full_name_ar ?? user.full_name_en ?? "?")[0]}
                          </div>
                          <div>
                            <p className="font-medium">{user.full_name_ar}</p>
                            {user.full_name_en ? (
                              <p className="text-xs text-muted-foreground">{user.full_name_en}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge key={role.id} variant="secondary" className="text-xs">
                              {role.name_ar}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.is_active ? "default" : "destructive"}>
                          {user.is_active ? t("status.active") : t("status.inactive")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatLocalizedDate(user.created_at, locale)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditUser(user)}
                            aria-label={t("actions.edit")}
                            title={t("actions.edit")}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setRolesUser(user)}
                            aria-label={t("actions.changeRole")}
                            title={t("actions.changeRole")}
                          >
                            <UserCog className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setStagesUser(user)}
                            aria-label={t("actions.assignments")}
                            title={t("actions.assignments")}
                          >
                            <Layers className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeactivateUser(user)}
                            aria-label={t("actions.deactivate")}
                            title={t("actions.deactivate")}
                            className="text-destructive hover:text-destructive"
                          >
                            <UserX className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              {!isLoading && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
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

      {createOpen && (
        <UserForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          churchId={scopeChurchId ?? undefined}
        />
      )}

      {editUser && (
        <UserForm
          open={!!editUser}
          onOpenChange={(open) => { if (!open) setEditUser(null); }}
          userId={editUser.id}
          churchId={scopeChurchId ?? undefined}
        />
      )}

      {rolesUser && (
        <UserRoleAssignment
          open={!!rolesUser}
          onOpenChange={(open) => { if (!open) setRolesUser(null); }}
          userId={rolesUser.id}
          currentRoleIds={rolesUser.roles.map((r) => r.id)}
          churchId={scopeChurchId ?? undefined}
        />
      )}

      {stagesUser && (
        <UserAssignmentsDialog
          open={!!stagesUser}
          onOpenChange={(open) => { if (!open) setStagesUser(null); }}
          userId={stagesUser.id}
          churchId={scopeChurchId ?? undefined}
        />
      )}

      <ConfirmDialog
        open={!!deactivateUser}
        onOpenChange={(open) => { if (!open) setDeactivateUser(null); }}
        title={t("deactivate.title")}
        description={t("deactivate.description", { name: deactivateUser?.full_name_ar ?? "" })}
        confirmLabel={t("deactivate.confirm")}
        cancelLabel={t("deactivate.cancel")}
        processingLabel={t("deactivate.processing")}
        destructive
        isSubmitting={deactivateMutation.isPending}
        errorMessage={deactivateMutation.data?.success === false ? deactivateMutation.data.message : null}
        onConfirm={handleDeactivate}
      />
    </section>
  );
}
