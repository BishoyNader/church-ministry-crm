import { useLocale } from "next-intl";

export function useDirection() {
  const locale = useLocale();
  return locale === "ar" ? "rtl" : "ltr";
}

export function useRtl() {
  const locale = useLocale();
  return locale === "ar";
}
