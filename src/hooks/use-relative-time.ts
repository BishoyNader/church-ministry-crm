"use client";

import { useLocale, useTranslations } from "next-intl";

type RelativeTimeOptions = {
  /** When the reference date lies in the future (e.g. upcoming follow-ups). */
  future?: boolean;
};

/**
 * Localized relative-time formatter shared across dashboards and lists.
 * Replaces the duplicated `timeAgo`/`formatRelativeDate` helpers that
 * hardcoded Arabic strings in components.
 */
export function useRelativeTime() {
  const locale = useLocale();
  const t = useTranslations("common.time");

  return ({ date, future = false }: { date: string | Date } & RelativeTimeOptions): string => {
    const target = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffMs = Math.abs(target.getTime() - now.getTime());
    const absMins = Math.round(diffMs / 60000);

    if (absMins < 1) return t("now");

    if (absMins < 60) {
      return future
        ? t("inMinutes", { value: Math.round(absMins) })
        : t("minutesAgo", { value: Math.round(absMins) });
    }

    const hours = Math.round(absMins / 60);
    if (hours < 24) {
      return future
        ? t("inHours", { value: hours })
        : t("hoursAgo", { value: hours });
    }

    const days = Math.round(hours / 24);
    if (days < (future ? 7 : 30)) {
      return future
        ? t("inDays", { value: days })
        : t("daysAgo", { value: days });
    }

    return target.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };
}
