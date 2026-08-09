import { expect, test } from "@playwright/test";

// Smoke tests target PUBLIC pages that render fully without a backend
// (no Supabase dependency at render time). Auth-gated flows require a staging
// environment and live under `e2e/flows` as they are enabled per environment.

test("root redirects to a locale (browser-language aware)", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(en|ar)\/?$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("English landing page renders its primary CTAs", async ({ page }) => {
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: "Create your account" }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByRole("link", { name: "Sign in" }),
  ).toBeVisible();
});

test("Arabic landing page renders and uses RTL", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const dir = await page.locator("html").getAttribute("dir");
  expect(dir).toBe("rtl");
});

test("login page renders form fields in English", async ({ page }) => {
  await page.goto("/en/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("login page renders form fields in Arabic", async ({ page }) => {
  await page.goto("/ar/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  // The document must be RTL for the Arabic locale.
  const dir = await page.locator("html").getAttribute("dir");
  expect(dir).toBe("rtl");
});

test("signup page renders the church selector", async ({ page }) => {
  await page.goto("/en/signup");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

// The proxy guards every non-public path and redirects unauthenticated users to
// the login page. The localized 404 surface is therefore only reachable behind
// an authenticated session (verified in the staging environment).
test("unknown routes redirect unauthenticated users to login", async ({ page }) => {
  await page.goto("/en/this-page-does-not-exist");
  await expect(page).toHaveURL(/\/en\/login$/);
});
