"use client";

import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that updates after `delayMs` of
 * inactivity. Replaces the duplicated `useEffect + setTimeout` search-debounce
 * pattern found across list pages.
 *
 *   const [searchInput, setSearchInput] = useState("");
 *   const search = useDebouncedValue(searchInput, 300);
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
