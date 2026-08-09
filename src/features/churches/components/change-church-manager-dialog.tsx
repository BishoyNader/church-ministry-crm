"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useChurchUsers, useChangeChurchManager } from "../hooks/use-churches";
import { useRoles } from "@/features/users/hooks/use-users";
import { UserForm } from "@/features/users/components/user-form";

type ChangeChurchManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  currentManagerId: string | null | undefined;
};

/**
 * Assign (or replace) the Church Manager of a church.
 *
 * Two paths reuse the existing architecture:
 *  - Select an existing church user → change_church_manager RPC (035).
 *  - Create a new user → UserForm with the church preselected and the
 *    super_admin role preset; createUserAction applies the same
 *    manager-replacement safety (confirmation + swap) as manual creation.
 *
 * Replacing an existing manager requires explicit confirmation; the RPC ends
 * the previous manager's grant and audits the swap.
 */
export function ChangeChurchManagerDialog({
  open,
  onOpenChange,
  churchId,
  currentManagerId,
}: ChangeChurchManagerDialogProps) {
  const t = useTranslations("churches");
  const queryClient = useQueryClient();

  const { data, isLoading } = useChurchUsers(churchId, { pageSize: 100 });
  const rolesQuery = useRoles(churchId);
  const mutation = useChangeChurchManager();

  const [selectedUserId, setSelectedUserId] = useState("");
  const [confirmedReplace, setConfirmedReplace] = useState(false);
  const [creating, setCreating] = useState(false);

  const users = (data?.data?.rows ?? []).filter(
    (user) => user.id !== currentManagerId && user.isActive,
  );
  const hasManager = !!currentManagerId;
  const superAdminRole = rolesQuery.data?.data?.find(
    (role) => role.role_type === "super_admin",
  );

  const handleConfirm = async () => {
    if (!selectedUserId) return;
    try {
      await mutation.mutateAsync({ churchId, newUserId: selectedUserId });
      onOpenChange(false);
    } catch {
      // Error surfaced via mutation.error
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedUserId("");
      setConfirmedReplace(false);
      setCreating(false);
    }
    onOpenChange(nextOpen);
  };

  const handleCreated = () => {
    setCreating(false);
    // The new manager changed church data; refresh the manager card, users tab,
    // and any open picker.
    queryClient.invalidateQueries({ queryKey: ["churches"] });
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const handleCreatedSuccess = () => {
    // Creation succeeded → close the dialog so the fresh manager state is
    // visible on the card instead of a stale, empty user list.
    handleClose(false);
  };

  const confirmDisabled =
    mutation.isPending || !selectedUserId || (hasManager && !confirmedReplace);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogPopup className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {hasManager ? t("manager.changeTitle") : t("manager.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {hasManager
                ? t("manager.changeDescription")
                : t("manager.addDescription")}
            </DialogDescription>
          </DialogHeader>

          {open && (
            <div className="space-y-4">
              {mutation.error?.message ? (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {mutation.error.message}
                </div>
              ) : null}

              {isLoading || rolesQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : users.length === 0 ? (
                <div className="rounded-xl border border-muted bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  {t("manager.noUsersYet")}
                </div>
              ) : (
                <>
                  <Select
                    value={selectedUserId}
                    onValueChange={(value) => setSelectedUserId(String(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("manager.selectPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullNameAr} · {user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {hasManager ? (
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={confirmedReplace}
                        onCheckedChange={(checked) => setConfirmedReplace(!!checked)}
                      />
                      {t("manager.confirmReplace")}
                    </label>
                  ) : null}
                </>
              )}

              <div className="flex items-center gap-2 rounded-xl border border-muted bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <UserPlus className="size-4 shrink-0" />
                <span>{t("manager.orCreateNew")}</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="ms-auto px-0"
                  onClick={() => setCreating(true)}
                  disabled={creating || !superAdminRole}
                >
                  {t("manager.createNew")}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={mutation.isPending}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={confirmDisabled}
              className="gap-2"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {mutation.isPending ? t("manager.saving") : t("manager.confirm")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {creating && superAdminRole ? (
        <UserForm
          open={creating}
          onOpenChange={(nextOpen) => {
            setCreating(nextOpen);
            if (!nextOpen) handleCreated();
          }}
          onSuccess={handleCreatedSuccess}
          churchId={churchId}
          presetRoleIds={[superAdminRole.id]}
        />
      ) : null}
    </>
  );
}
