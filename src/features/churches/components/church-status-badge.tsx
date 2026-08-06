"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ChurchStatus } from "../types/church.types";

const STATUS_VARIANT: Record<ChurchStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "secondary",
  suspended: "outline",
  disabled: "destructive",
};

export function ChurchStatusBadge({ status }: { status: ChurchStatus }) {
  const t = useTranslations("churches");
  return <Badge variant={STATUS_VARIANT[status]}>{t(`status${capitalize(status)}`)}</Badge>;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
