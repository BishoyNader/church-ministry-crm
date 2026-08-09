"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Download,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  SearchX,
  ShieldCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/layout/section-card";
import { PaginationBar } from "@/components/layout/pagination-bar";
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useUserList,
  useExportUsers,
  useDeactivateUser,
} from "@/features/users/hooks/use-users";
import { UserForm } from "@/features/users/components/user-form";
import { UserRoleAssignment } from "@/features/users/components/user-role-assignment";
import { UserStageAssignment } from "@/features/users/components/user-stage-assignment";
import { UserImportPanel } from "@/features/users/components/user-import-panel";
import type { UserListItem } from "@/features/users/types/user.types";
import { useChurchDetail } from "../hooks/use-churches";
import { ChangeChurchManagerDialog } from "./change-church-manager-dialog";

const PAGE_SIZE = 10;

type ChurchUsersTableProps = {
  churchId: string;
};

function triggerDownload(fileName: string, content: string, mimeType: string) {
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
}

export function ChurchUsersTable({ churchId }: ChurchUsersTableProps) {
  const t = useTranslations("churches");
  const ut = useTranslations("users");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [rolesUser, setRolesUser] = useState<UserListItem | null>(null);
  const [stagesUser, setStagesUser] = useState<UserListItem | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserListItem | null>(null);
  const [changeManagerOpen, setChangeManagerOpen] = useState(false);

  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");
  const [exportError, setExportError] = useState<string | null>(null);

  const churchDetailQuery = useChurchDetail(churchId);
  const currentManagerId = churchDetailQuery.data?.data?.manager?.userId ?? null;

  const filters = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, search: search || undefined, churchId }),
    [page, search, churchId],
  );

  const { data, isLoading, error } = useUserList(filters);

  const users = data?.data?.users ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const exportMutation = useExportUsers();
  const deactivateMutation = useDeactivateUser();

  const handleExport = async () => {
    setExportError(null);
    const result = await exportMutation.mutateAsync({
      format: exportFormat,
      search: search || undefined,
      churchId,
    });

    if (!result.success || !result.data) {
      setExportError(result.message ?? ut("export.error"));
      return;
    }

    triggerDownload(result.data.fileName, result.data.content, result.data.mimeType);
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    const result = await deactivateMutation.mutateAsync({
      userId: deactivateUser.id,
      churchId,
    });
    if (result.success) setDeactivateUser(null);
  };

  if (error) {
    return (
      <div className="py-10 text-center text-destructive">{error.message}</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("users.searchPlaceholder")}
              aria-label={t("users.searchPlaceholder")}
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
              }}
              className="ps-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={exportFormat}
              onValueChange={(val) => setExportFormat(val as "csv" | "xlsx")}
            >
              <SelectTrigger className="w-24" aria-label={ut("export.formatLabel")}>
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
              disabled={exportMutation.isPending}
              className="gap-2"
            >
              {exportMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {ut("export.button")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setChangeManagerOpen(true)} className="gap-2">
            <ShieldCheck className="size-4" />
            {t("users.changeManager")}
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            {t("users.addUser")}
          </Button>
        </div>
      </div>

      {exportError ? (
        <p className="text-sm text-destructive">{exportError}</p>
      ) : null}

      <UserImportPanel churchId={churchId} />

      <SectionCard>
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <SearchX className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("users.emptyState")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{ut("table.caption")}</caption>
              <thead>
                <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3">{ut("table.name")}</th>
                  <th scope="col" className="px-4 py-3">{ut("table.email")}</th>
                  <th scope="col" className="px-4 py-3">{ut("table.roles")}</th>
                  <th scope="col" className="px-4 py-3">{ut("table.status")}</th>
                  <th scope="col" className="px-4 py-3">{ut("table.joined")}</th>
                  <th scope="col" className="px-4 py-3 text-end">{ut("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
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
                        {user.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          user.roles.map((role) => (
                            <Badge key={role.id} variant="secondary" className="text-xs">
                              {role.name_ar}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.is_active ? "default" : "destructive"}>
                        {user.is_active ? ut("status.active") : ut("status.inactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditUser(user)}
                          aria-label={ut("actions.edit")}
                          title={ut("actions.edit")}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setRolesUser(user)}
                          aria-label={ut("actions.changeRole")}
                          title={ut("actions.changeRole")}
                        >
                          <UserCog className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setStagesUser(user)}
                          aria-label={ut("actions.assignStages")}
                          title={ut("actions.assignStages")}
                        >
                          <Layers className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeactivateUser(user)}
                          aria-label={ut("actions.deactivate")}
                          title={ut("actions.deactivate")}
                          className="text-destructive hover:text-destructive"
                        >
                          <UserX className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-t px-0">
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              labelMode="count"
              onPageChange={setPage}
            />
          </div>
        )}
      </SectionCard>

      {createOpen && (
        <UserForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          churchId={churchId}
        />
      )}

      {editUser && (
        <UserForm
          open={!!editUser}
          onOpenChange={(open) => {
            if (!open) setEditUser(null);
          }}
          userId={editUser.id}
          churchId={churchId}
        />
      )}

      {rolesUser && (
        <UserRoleAssignment
          open={!!rolesUser}
          onOpenChange={(open) => {
            if (!open) setRolesUser(null);
          }}
          userId={rolesUser.id}
          currentRoleIds={rolesUser.roles.map((r) => r.id)}
          churchId={churchId}
        />
      )}

      {stagesUser && (
        <UserStageAssignment
          open={!!stagesUser}
          onOpenChange={(open) => {
            if (!open) setStagesUser(null);
          }}
          userId={stagesUser.id}
          churchId={churchId}
        />
      )}

      <ChangeChurchManagerDialog
        open={changeManagerOpen}
        onOpenChange={setChangeManagerOpen}
        churchId={churchId}
        currentManagerId={currentManagerId}
      />

      <Dialog open={!!deactivateUser} onOpenChange={(open) => { if (!open) setDeactivateUser(null); }}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{ut("deactivate.title")}</DialogTitle>
            <DialogDescription>
              {ut("deactivate.description", { name: deactivateUser?.full_name_ar ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {ut("deactivate.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? ut("deactivate.processing") : ut("deactivate.confirm")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
