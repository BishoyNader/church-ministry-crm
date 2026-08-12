"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useUserDetail,
  useAssignRoles,
  useRoles,
  useActorChurch,
} from "../hooks/use-users";

type UserRoleAssignmentProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentRoleIds: string[];
  churchId?: string;
};

export function UserRoleAssignment({
  open,
  onOpenChange,
  userId,
  currentRoleIds,
  churchId,
}: UserRoleAssignmentProps) {
  const t = useTranslations("users.roles");
  const [selectedIds, setSelectedIds] = useState<string[]>(currentRoleIds);

  const detailQuery = useUserDetail(userId, churchId);
  const assignMutation = useAssignRoles();

  const user = detailQuery.data?.data;
  const scopeChurchId = churchId ?? user?.church_id ?? null;
  const rolesQuery = useRoles(scopeChurchId);
  const roles = rolesQuery.data?.data ?? [];

  const actorChurchQuery = useActorChurch();
  const isPlatformOwner = actorChurchQuery.data?.isPlatformOwner ?? false;
  // Church-scoped actors can never grant the super_admin (Church Manager) role
  // (050): changing the Church Manager is a Platform Owner operation.
  const assignableRoles = isPlatformOwner
    ? roles
    : roles.filter((role) => role.role_type !== "super_admin");

  const toggle = (roleId: string) => {
    setSelectedIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

  const handleSave = async () => {
    const result = await assignMutation.mutateAsync({
      userId,
      roleIds: selectedIds,
      churchId: scopeChurchId ?? undefined,
    });
    if (result.success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: user?.full_name_ar ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {rolesQuery.isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))
            : assignableRoles.map((role) => (
                <label
                  key={role.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <Checkbox
                    checked={selectedIds.includes(role.id)}
                    onCheckedChange={() => toggle(role.id)}
                  />
                  <div>
                    <p className="text-sm font-medium">{role.name_ar}</p>
                    {role.description_ar ? (
                      <p className="text-xs text-muted-foreground">{role.description_ar}</p>
                    ) : null}
                  </div>
                </label>
              ))}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <Button onClick={handleSave} disabled={assignMutation.isPending}>
            {assignMutation.isPending ? t("processing") : t("save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
