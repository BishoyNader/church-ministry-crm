"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/features/rbac";
import type { ChurchListItem, ChurchStatus } from "../types/church.types";

type ChurchActionsMenuProps = {
  church: ChurchListItem;
  onView: (church: ChurchListItem) => void;
  onEdit: (church: ChurchListItem) => void;
  onStatusChange: (church: ChurchListItem, status: ChurchStatus) => void;
  onChangeManager: (church: ChurchListItem) => void;
  onViewAudit: (church: ChurchListItem) => void;
};

type MenuItemProps = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

function MenuItem({ label, onSelect, destructive }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-accent ${
        destructive ? "text-destructive" : ""
      }`}
    >
      {label}
    </button>
  );
}

export function ChurchActionsMenu({
  church,
  onView,
  onEdit,
  onStatusChange,
  onChangeManager,
  onViewAudit,
}: ChurchActionsMenuProps) {
  const t = useTranslations("churches");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const close = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("actions.menu")}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      {open && (
        <div className="absolute end-0 z-50 mt-1 min-w-[180px] overflow-hidden rounded-md border bg-popover py-1 shadow-md">
          <MenuItem label={t("actions.view")} onSelect={close(() => onView(church))} />

          <PermissionGuard permission="tenants.update">
            <MenuItem label={t("actions.edit")} onSelect={close(() => onEdit(church))} />
            {church.status === "active" && (
              <>
                <MenuItem label={t("actions.deactivate")} onSelect={close(() => onStatusChange(church, "inactive"))} />
                <MenuItem label={t("actions.suspend")} onSelect={close(() => onStatusChange(church, "suspended"))} />
                <MenuItem label={t("actions.disable")} onSelect={close(() => onStatusChange(church, "disabled"))} destructive />
              </>
            )}
            {church.status === "inactive" && (
              <>
                <MenuItem label={t("actions.activate")} onSelect={close(() => onStatusChange(church, "active"))} />
                <MenuItem label={t("actions.disable")} onSelect={close(() => onStatusChange(church, "disabled"))} destructive />
              </>
            )}
            {church.status === "suspended" && (
              <>
                <MenuItem label={t("actions.reactivate")} onSelect={close(() => onStatusChange(church, "active"))} />
                <MenuItem label={t("actions.disable")} onSelect={close(() => onStatusChange(church, "disabled"))} destructive />
              </>
            )}
            {church.status === "disabled" && (
              <MenuItem label={t("actions.reactivate")} onSelect={close(() => onStatusChange(church, "active"))} />
            )}
            <MenuItem label={t("actions.changeManager")} onSelect={close(() => onChangeManager(church))} />
          </PermissionGuard>

          <MenuItem label={t("actions.viewAudit")} onSelect={close(() => onViewAudit(church))} />
        </div>
      )}
    </div>
  );
}
