"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

type PlanBadgeProps = {
  plan: string;
  size?: "sm" | "default";
};

export function PlanBadge({ plan, size = "default" }: PlanBadgeProps) {
  const t = useTranslations("billing.plans");

  const variantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    yearly: "default",
    monthly: "secondary",
    trial: "outline",
    free: "outline",
  };

  return (
    <Badge variant={variantMap[plan] ?? "outline"} className={size === "sm" ? "text-xs" : ""}>
      {t(plan)}
    </Badge>
  );
}
