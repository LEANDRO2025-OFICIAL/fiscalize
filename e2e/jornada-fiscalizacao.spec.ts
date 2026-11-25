import { test, expect } from "@playwright/test";

test.describe("Jornada", () => {
  test("fiscal entra com senha e vê o painel", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "fiscal@exemplo.gov.br");
    await page.fill("#senha", "Demo@2026");
    await page.click("button[type=submit]");
    await page.waitForURL("**/inicio");
    await expect(page.locator("h1")).toHaveText("Início");
  });

  test("senha errada é recusada", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "ninguem@exemplo.gov.br");
    await page.fill("#senha", "errada");
    await page.click("button[type=submit]");
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("cookie forjado não dá acesso", async ({ page }) => {
    await page.context().addCookies([{ name: "sessao", value: "eyJ1IjoieCJ9.assinaturafalsa", url: "http://localhost:3000" }]);
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/login/);
  });
});
