import { describe, expect, it } from "vitest";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

type JsonObject = Record<string, unknown>;

function flattenKeys(obj: JsonObject, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as JsonObject, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function flattenValues(obj: JsonObject, prefix = ""): Array<{ key: string; value: unknown }> {
  const out: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out.push(...flattenValues(value as JsonObject, path));
    } else {
      out.push({ key: path, value });
    }
  }
  return out;
}

describe("translation parity (en ↔ ar)", () => {
  it("has the exact same flat key set in both locales", () => {
    const enKeys = flattenKeys(en as JsonObject).sort();
    const arKeys = flattenKeys(ar as JsonObject).sort();

    expect(enKeys).toEqual(arKeys);
  });

  it("has no empty or whitespace-only values", () => {
    const entries = flattenValues(ar as JsonObject);
    const empty = entries.filter(
      ({ value }) => typeof value === "string" && value.trim() === "",
    );
    expect(empty).toEqual([]);
  });

  it("keeps every Arabic leaf translated (contains Arabic script unless it is a placeholder-only technical value)", () => {
    const entries = flattenValues(ar as JsonObject);
    // Technical literals that must stay identical across locales (formats,
    // slugs, URLs, and enum values users type into the field).
    const TECHNICAL_PLACEHOLDERS = new Set([
      "churches.form.placeholderSlug",
      "churches.form.placeholderEmail",
      "churches.form.placeholderPhone",
      "churches.form.placeholderTier",
      "churches.form.placeholderStatus",
      "churches.form.placeholderLocale",
    ]);

    const untranslated = entries.filter(({ key, value }) => {
      if (typeof value !== "string") return false;
      if (TECHNICAL_PLACEHOLDERS.has(key)) return false;
      // Values that are pure placeholders are exempt.
      if (/^\{.*\}$/.test(value.trim())) return false;
      return !/[\u0600-\u06FF]/.test(value);
    });

    expect(untranslated.map((e) => e.key)).toEqual([]);
  });
});
