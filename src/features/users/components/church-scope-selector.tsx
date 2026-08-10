"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useActorChurch } from "../hooks/use-users";
import { useChurchList } from "@/features/churches/hooks/use-churches";

/**
 * ChurchScopeSelector — church picker shown only to platform owners
 * (church_id NULL). Church super admins are always scoped to their own
 * church and render nothing here.
 *
 * The PO is global (church_id NULL) and may manage ANY church, so this lists
 * every church the PO is authorized to manage — the same source as Church
 * Management (all statuses, no status filter; the service caps page size at
 * 100, far beyond any real church count). Status/manager are shown alongside
 * the name so a non-active church is still visible and understandable.
 */
export function ChurchScopeSelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (churchId: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("users.churchScope");
  const ct = useTranslations("churches");
  const { data: actor, isLoading: actorLoading } = useActorChurch();
  const { data, isLoading } = useChurchList({ pageSize: 100 });

  if (actorLoading) return <Skeleton className="h-9 w-56" />;

  if (actor?.churchId) return null;

  if (isLoading) return <Skeleton className="h-9 w-56" />;

  const churches = data?.data?.rows ?? [];

  const statusLabel = (status: string): string => {
    switch (status) {
      case "active":
        return ct("statusActive");
      case "inactive":
        return ct("statusInactive");
      case "suspended":
        return ct("statusSuspended");
      case "disabled":
        return ct("statusDisabled");
      default:
        return status;
    }
  };

  return (
    <Select
      value={value || undefined}
      onValueChange={(val) => onChange(val as string)}
      disabled={disabled}
      items={churches.map((church) => ({ value: church.id, label: church.name_ar }))}
    >
      <SelectTrigger className="w-full sm:w-64" aria-label={t("label")}>
        <SelectValue placeholder={t("placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {churches.map((church) => (
          <SelectItem key={church.id} value={church.id} label={church.name_ar}>
            <span className="flex items-center gap-2">
              <span className="truncate">{church.name_ar}</span>
              <span className="text-xs text-muted-foreground">
                {statusLabel(church.status)}
                {church.manager ? ` · ${church.manager.fullNameAr}` : ""}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
