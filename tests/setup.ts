import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library auto-cleanup relies on a global `afterEach`; with
// `globals: false` we register it explicitly.
afterEach(() => {
  cleanup();
});
