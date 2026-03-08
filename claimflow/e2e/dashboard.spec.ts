import { test, expect } from "@playwright/test";

test.describe("Dashboard — Manager view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[id="email"]', "manager@claimflow.fr");
    await page.fill('[id="password"]', "manager123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");
  });

  test("displays dashboard page with title", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Vue d'ensemble de l'activité")).toBeVisible();
  });

  test("shows KPI cards", async ({ page }) => {
    await expect(page.getByText("Total sinistres")).toBeVisible();
    await expect(page.getByText("En attente")).toBeVisible();
    await expect(page.getByText("Taux de fraude")).toBeVisible();
    await expect(page.getByText("Montant estimé total")).toBeVisible();
  });

  test("shows period selector", async ({ page }) => {
    const select = page.locator("select");
    await expect(select).toBeVisible();
    // Change period
    await select.selectOption("7d");
    await expect(page.getByText("7 derniers jours")).toBeVisible();
  });

  test("shows status breakdown cards", async ({ page }) => {
    await expect(page.getByText("Soumis")).toBeVisible();
    await expect(page.getByText("En instruction")).toBeVisible();
    await expect(page.getByText("Approuvé")).toBeVisible();
  });

  test("navbar shows correct role", async ({ page }) => {
    await expect(page.getByText("Manager")).toBeVisible();
    await expect(page.getByText("Marc Manager")).toBeVisible();
  });

  test("navbar has correct links for manager", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Sinistres" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    // Admin link should not be visible for manager
    const adminLink = page.getByRole("link", { name: "Administration" });
    await expect(adminLink).not.toBeVisible();
  });

  test("handler cannot access dashboard", async ({ page }) => {
    // Sign out first
    await page.click('button:has-text("Déconnexion")');
    await page.waitForURL("**/login");
    // Login as handler
    await page.fill('[id="email"]', "handler@claimflow.fr");
    await page.fill('[id="password"]', "handler123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/claims");
    // Try to navigate to dashboard
    await page.goto("/dashboard");
    // Should be redirected
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
