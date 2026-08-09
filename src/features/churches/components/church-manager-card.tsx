"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Pencil, ShieldCheck, UserPlus, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SectionCard } from "@/components/layout/section-card";
import { PermissionGuard } from "@/features/rbac";
import { Badge } from "@/components/ui/badge";
import {
  useDeactivateChurchUser,
  useResetChurchManagerPassword,
} from "../hooks/use-churches";
import { ChangeChurchManagerDialog } from "./change-church-manager-dialog";
import { UserForm } from "@/features/users/components/user-form";
import type { ChurchDetail } from "../types/church.types";

type ChurchManagerCardProps = {
  church: ChurchDetail;
};

export function ChurchManagerCard({ church }: ChurchManagerCardProps) {
  const t = useTranslations("churches");
  const manager = church.manager;

  const [changeOpen, setChangeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [manageUserOpen, setManageUserOpen] = useState(false);
  const [password, setPassword] = useState("");

  const resetMutation = useResetChurchManagerPassword();
  const disableMutation = useDeactivateChurchUser();

  const resetError = resetMutation.error?.message ?? null;
  const disableError = disableMutation.error?.message ?? null;

  const resetPassword = async () => {
    try {
      await resetMutation.mutateAsync({ churchId: church.id, newPassword: password });
      setPassword("");
      setResetOpen(false);
    } catch {
      // Error surfaced via mutation.error
    }
  };

  const disableManager = async () => {
    if (!manager) return;
    try {
      await disableMutation.mutateAsync({ churchId: church.id, userId: manager.userId });
      setDisableOpen(false);
    } catch {
      // Error surfaced via mutation.error
    }
  };

  return (
    <SectionCard className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {manager ? (manager.fullNameAr || manager.email || "?").charAt(0) : "—"}
          </div>
          <div className="space-y-1">
            <p className="font-medium">{manager ? manager.fullNameAr : t("manager.notAssigned")}</p>
            {manager ? (
              <>
                <p className="text-sm text-muted-foreground">{manager.email}</p>
                <p className="text-sm text-muted-foreground">{manager.phone ?? "—"}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{t("manager.lastLogin")}: {manager.lastLoginAt ? new Date(manager.lastLoginAt).toLocaleString() : "—"}</span>
                  <Badge variant={manager.isActive ? "default" : "secondary"}>
                    {manager.isActive ? t("manager.statusActive") : t("manager.statusInactive")}
                  </Badge>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <PermissionGuard permission="tenants.update">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {manager ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => setChangeOpen(true)}>
                  <ShieldCheck className="size-4" />
                  {t("manager.change")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setManageUserOpen(true)}>
                  <Pencil className="size-4" />
                  {t("manager.manageUser")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setResetOpen(true)}>
                  <KeyRound className="size-4" />
                  {t("manager.resetPassword")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDisableOpen(true)}
                  disabled={disableMutation.isPending}
                >
                  <UserX className="size-4" />
                  {t("manager.disable")}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => setChangeOpen(true)} className="gap-2">
                <UserPlus className="size-4" />
                {t("manager.add")}
              </Button>
            )}
          </div>
        </PermissionGuard>
      </div>

      <ChangeChurchManagerDialog
        open={changeOpen}
        onOpenChange={setChangeOpen}
        churchId={church.id}
        currentManagerId={manager?.userId}
      />

      {manager ? (
        <UserForm
          open={manageUserOpen}
          onOpenChange={setManageUserOpen}
          userId={manager.userId}
          churchId={church.id}
        />
      ) : null}

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogPopup className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t("manager.resetTitle")}</DialogTitle>
            <DialogDescription>{t("manager.resetDescription")}</DialogDescription>
          </DialogHeader>

          {resetError && (
            <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {resetError}
            </div>
          )}

          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("manager.passwordPlaceholder")}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={resetMutation.isPending}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={resetPassword} disabled={resetMutation.isPending || password.length < 8}>
              {resetMutation.isPending ? t("manager.saving") : t("manager.confirm")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogPopup className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t("manager.disableTitle")}</DialogTitle>
            <DialogDescription>{t("manager.disableDescription")}</DialogDescription>
          </DialogHeader>

          {disableError && (
            <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {disableError}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDisableOpen(false)} disabled={disableMutation.isPending}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={disableManager} disabled={disableMutation.isPending}>
              {disableMutation.isPending ? t("manager.saving") : t("manager.confirmDisable")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </SectionCard>
  );
}
