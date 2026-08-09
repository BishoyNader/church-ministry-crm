import { describe, expect, it } from "vitest";
import {
  CHILD_ACTION_ERROR_KEYS,
  CHILD_RPC_ERROR_KEYS,
  isChildRpcError,
  mapChildErrorKey,
} from "@/features/children/utils/error-mapper";
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

const errors =
  ((en as JsonObject).children as JsonObject).errors as JsonObject;

describe("mapChildErrorKey", () => {
  it("maps every DB RPC error code to a children.errors key", () => {
    for (const [code, key] of Object.entries(CHILD_RPC_ERROR_KEYS)) {
      expect(mapChildErrorKey(code)).toBe(key);
      expect(isChildRpcError(code)).toBe(true);
    }
  });

  it("maps every app-layer gate failure to a children.errors key", () => {
    for (const [gate, key] of Object.entries(CHILD_ACTION_ERROR_KEYS)) {
      expect(mapChildErrorKey(gate)).toBe(key);
      expect(isChildRpcError(gate)).toBe(false);
    }
  });

  it("passes unknown messages through as null", () => {
    expect(mapChildErrorKey("some raw postgres message")).toBeNull();
    expect(mapChildErrorKey("")).toBeNull();
  });
});

describe("mapped keys exist in both locales", () => {
  it("defines every mapped key under children.errors in en and ar", () => {
    const enKeys = flattenKeys(en as JsonObject);
    const arKeys = flattenKeys(ar as JsonObject);
    const enErrors = ((en as JsonObject).children as JsonObject).errors as JsonObject;
    const arErrors = ((ar as JsonObject).children as JsonObject).errors as JsonObject;

    for (const key of Object.values({
      ...CHILD_RPC_ERROR_KEYS,
      ...CHILD_ACTION_ERROR_KEYS,
    })) {
      expect(enKeys).toContain(`children.errors.${key}`);
      expect(arKeys).toContain(`children.errors.${key}`);
      expect(typeof enErrors[key]).toBe("string");
      expect(typeof arErrors[key]).toBe("string");
    }
  });

  it("keeps the errors block flat (no nested objects)", () => {
    const nested = Object.entries(errors).filter(
      ([, value]) => value && typeof value === "object",
    );
    expect(nested).toEqual([]);
  });
});
