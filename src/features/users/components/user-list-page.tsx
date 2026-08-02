"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { PermissionGuard } from "@/features/rbac";
import { useUserList, useDeactivateUser } from "../hooks/use-users";
import { PendingRegistrationsQueue } from "./pending-registrations-queue";
import { UserForm } from "./user-form";
import { UserRoleAssignment } from "./user-role-assignment";
import { UserStageAssignment } from "./user-stage-assignment";
import type { UserListItem } from "../types/user.types";

const ROLE_FILTER_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "super_admin", label: "Super Admin" },
  { value: "church_admin", label: "Church Admin" },
  { value: "stage_leader", label: "Stage Leader" },
  { value: "servant", label: "Servant" },
  { value: "viewer", label: "Viewer" },
] as const;

const PAGE_SIZE = 20;

export function UserListPage() {
  const t = useTranslations("users");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [rolesUser, setRolesUser] = useState<UserListItem | null>(null);
  const [stagesUser, setStagesUser] = useState<UserListItem | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserListItem | null>(null);

  const { data, isLoading } = useUserList({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    roleFilter: roleFilter !== "all" ? roleFilter : undefined,
  });

  const deactivateMutation = useDeactivateUser();

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    const result = await deactivateMutation.mutateAsync(deactivateUser.id);
    if (result.success) setDeactivateUser(null);
  };

  const users = data?.data?.users ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

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

      <PermissionGuard permission="servants.approve">
        <PendingRegistrationsQueue />
      </PermissionGuard>

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
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
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">{t("table.name")}</th>
                <th className="px-4 py-3">{t("table.email")}</th>
                <th className="px-4 py-3">{t("table.roles")}</th>
                <th className="px-4 py-3">{t("table.status")}</th>
                <th className="px-4 py-3">{t("table.joined")}</th>
                <th className="px-4 py-3 text-end">{t("table.actions")}</th>
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
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditUser(user)}
                            aria-label={t("actions.edit")}
                          >
                            <MoreHorizontal className="size-4" />
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
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t("pagination.showing", { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total })}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("pagination.prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("pagination.next")}
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {createOpen && (
        <UserForm open={createOpen} onOpenChange={setCreateOpen} />
      )}

      {editUser && (
        <UserForm
          open={!!editUser}
          onOpenChange={(open) => { if (!open) setEditUser(null); }}
          userId={editUser.id}
        />
      )}

      {rolesUser && (
        <UserRoleAssignment
          open={!!rolesUser}
          onOpenChange={(open) => { if (!open) setRolesUser(null); }}
          userId={rolesUser.id}
          currentRoleIds={rolesUser.roles.map((r) => r.id)}
        />
      )}

      {stagesUser && (
        <UserStageAssignment
          open={!!stagesUser}
          onOpenChange={(open) => { if (!open) setStagesUser(null); }}
          userId={stagesUser.id}
        />
      )}

      <Dialog open={!!deactivateUser} onOpenChange={(open) => { if (!open) setDeactivateUser(null); }}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{t("deactivate.title")}</DialogTitle>
            <DialogDescription>
              {t("deactivate.description", { name: deactivateUser?.full_name_ar ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("deactivate.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? t("deactivate.processing") : t("deactivate.confirm")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
