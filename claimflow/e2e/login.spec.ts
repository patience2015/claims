import { test, expect } from "@playwright/test";

test.describe("Authentication — Login Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("displays login form", async ({ page }) => {
    await expect(page.getByText("ClaimFlow AI")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.fill('[id="email"]', "wrong@example.com");
    await page.fill('[id="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();
  });

  test("handler redirects to /claims after login", async ({ page }) => {
    await page.fill('[id="email"]', "handler@claimflow.fr");
    await page.fill('[id="password"]', "handler123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/claims");
    await expect(page).toHaveURL(/\/claims/);
    await expect(page.getByText("Sinistres")).toBeVisible();
  });

  test("manager redirects to /dashboard after login", async ({ page }) => {
    await page.fill('[id="email"]', "manager@claimflow.fr");
    await page.fill('[id="password"]', "manager123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("admin redirects to /admin after login", async ({ page }) => {
    await page.fill('[id="email"]', "admin@claimflow.fr");
    await page.fill('[id="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("unauthenticated user redirected to login from protected route", async ({ page }) => {
    await page.goto("/claims");
    await page.waitForURL("**/login**");
    await expect(page).toHaveURL(/\/login/);
  });
});
