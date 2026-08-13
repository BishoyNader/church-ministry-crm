export function dateLocale(locale: string): string {
  return locale === "ar" ? "ar-EG" : "en-US";
}

/** Localized date-only string, e.g. "Aug 13, 2026" / Arabic equivalent. */
export function formatLocalizedDate(value: string | Date, locale: string): string {
  return new Date(value).toLocaleDateString(dateLocale(locale), {
    dateStyle: "medium",
  });
}

/** Localized date + time string. */
export function formatLocalizedDateTime(value: string | Date, locale: string): string {
  return new Date(value).toLocaleString(dateLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
