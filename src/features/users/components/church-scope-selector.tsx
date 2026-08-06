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
  const { data: actor, isLoading: actorLoading } = useActorChurch();
  const { data, isLoading } = useChurchList({ status: "active" });

  if (actorLoading) return <Skeleton className="h-9 w-56" />;

  if (actor?.churchId) return null;

  if (isLoading) return <Skeleton className="h-9 w-56" />;

  const churches = data?.data?.rows ?? [];

  return (
    <Select
      value={value || undefined}
      onValueChange={(val) => onChange(val as string)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full sm:w-64" aria-label={t("label")}>
        <SelectValue placeholder={t("placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {churches.map((church) => (
          <SelectItem key={church.id} value={church.id}>
            {church.name_ar}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
