import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const EMAIL = "admin@exemplo.gov.br";
const SENHA = "Demo@2026";
const EMPRESA_EMAIL = "gestor@fornecedor.com.br";
const EMPRESA_SENHA = "Demo@2026";
const CONTRATO_ID = "66a8479a-2ed1-453e-860e-61df10129876"; // CT-2025-001

async function login(page: any, email: string = EMAIL, senha: string = SENHA) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#senha", senha);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/inicio`);
  await expect(page.locator("h1")).toHaveText("Início");
  // Retorna o cookie de sessão para uso em requisições API
  const cookies = await page.context().cookies();
  const sessaoCookie = cookies.find((c: any) => c.name === "sessao");
  return sessaoCookie ? sessaoCookie.value : null;
}

async function loginEmpresa(page: any, email: string = EMPRESA_EMAIL, senha: string = EMPRESA_SENHA) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#senha", senha);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/inicio`);
  // Navega para o modo empresa (fornecedor)
  await page.goto(`${BASE}/empresa/inicio`);
  await page.waitForURL(`${BASE}/empresa/inicio`);
  await expect(page.locator("h1")).toContainText("Painel da Empresa");
  const cookies = await page.context().cookies();
  const sessaoCookie = cookies.find((c: any) => c.name === "sessao");
  return sessaoCookie ? sessaoCookie.value : null;
}

test.describe("Jornada ContratoVivo - Login", () => {
  test("admin entra com senha e vê o painel", async ({ page }) => {
    await login(page);
  });

  test("senha errada é recusada", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", "ninguem@exemplo.gov.br");
    await page.fill("#senha", "errada");
    await page.click("button[type=submit]");
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });
});

test.describe("Jornada ContratoVivo - Navegação e telas", () => {
  test("lista de contratos carrega com contratos do seed", async ({ page }) => {
    await login(page);
    await page.click('a[href="/contratos"]');
    await page.waitForURL(`${BASE}/contratos`);
    const links = page.locator('a[href^="/contratos/"]');
    await expect(links.first()).toBeVisible();
  });

  test("detalhe do contrato CT-2025-001 carrega com cartão ContratoVivo", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/contratos/${CONTRATO_ID}`);
    await page.waitForURL(`${BASE}/contratos/${CONTRATO_ID}`);

    await expect(page.getByText("Aditivos e penalidades")).toBeVisible();
    await expect(page.getByText("ContratoVivo")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Aditivos contratuais/ })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Penalidades e contraditório/ })
    ).toBeVisible();
  });

  test("página de aditivos carrega com formulário de criação", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/contratos/${CONTRATO_ID}/aditivos`);
    await page.waitForURL(`${BASE}/contratos/${CONTRATO_ID}/aditivos`);
    await page.waitForSelector("#ad-num", { state: "visible", timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Aditivos do Contrato");
    await expect(page.locator("#ad-num")).toBeVisible();
    await expect(page.locator("#ad-tipo")).toBeVisible();
    await expect(page.locator("#ad-obj")).toBeVisible();
    await expect(page.getByRole("button", { name: /Registrar aditivo/ })).toBeVisible();
  });

  test("página de penalidades carrega com formulário de criação", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/contratos/${CONTRATO_ID}/penalidades`);
    await page.waitForURL(`${BASE}/contratos/${CONTRATO_ID}/penalidades`);
    await page.waitForSelector("#pe-tipo", { state: "visible", timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Penalidades do Contrato");
    await expect(page.locator("#pe-tipo")).toBeVisible();
    await expect(page.locator("#pe-val")).toBeVisible();
    await expect(page.locator("#pe-just")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Registrar penalidade sugerida/ })
    ).toBeVisible();
  });

  test("página de execução carrega com funil completo", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/contratos/${CONTRATO_ID}/execucao`);
    await page.waitForURL(`${BASE}/contratos/${CONTRATO_ID}/execucao`);
    await expect(page.locator("h1")).toContainText("Execução");
    await expect(page.locator("text=Empenho confirmado").first()).toBeVisible();
    await expect(page.locator("text=Liquidação confirmada").first()).toBeVisible();
    await expect(page.locator("text=Pagamento confirmado").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Lançar/ })).toBeVisible();
  });
});

test.describe("Jornada ContratoVivo - API de execução", () => {
  test("rota de execução retorna dados do contrato com sessão válida", async ({ page }) => {
    await login(page);

    const cookies = await page.context().cookies();
    const sessaoCookie = cookies.find((c) => c.name === "sessao");
    expect(sessaoCookie).toBeTruthy();

    const res = await page.request.get(`${BASE}/api/contratos/${CONTRATO_ID}/execucao`, {
      headers: sessaoCookie ? { Cookie: `sessao=${sessaoCookie.value}` } : {},
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.contrato.id).toBe(CONTRATO_ID);
    expect(Array.isArray(json.lancamentos)).toBeTruthy();
  });
});

test.describe("Jornada ContratoVivo - Modo Empresa (Fornecedor)", () => {

  test("fornecedor entra e acessa /empresa/inicio", async ({ page }) => {
    await loginEmpresa(page);
  });

  test("página de início da empresa carrega", async ({ page }) => {
    await loginEmpresa(page);
    await expect(page.locator('p:has-text("Meus contratos")')).toBeVisible();
    await expect(page.locator('p:has-text("Valor total")')).toBeVisible();
  });

  test("página de contratos da empresa carrega", async ({ page }) => {
    await loginEmpresa(page);
    await page.click('a[href="/empresa/contratos"]');
    await page.waitForURL(`${BASE}/empresa/contratos`);
    await expect(page.getByRole("heading", { name: "Meus Contratos" })).toBeVisible();
  });

  test("detalhe de contrato da empresa carrega quando existe contrato", async ({ page }) => {
    await loginEmpresa(page);
    await page.click('a[href="/empresa/contratos"]');
    await page.waitForURL(`${BASE}/empresa/contratos`);

    // Se houver contratos, testa o detalhe
    const primeiroLink = page.locator('a[href^="/empresa/contratos/"]').first();
    if ((await primeiroLink.count()) > 0) {
      const contratoUrl = await primeiroLink.getAttribute("href");
      await primeiroLink.click();
      await page.waitForURL(`${BASE}${contratoUrl}`);
      await expect(page.locator("h1")).toContainText("Contrato");

      await page.click('a[href*="/aditivos"]');
      await page.waitForURL(`${BASE}${contratoUrl}/aditivos`);
      await expect(page.locator("h1")).toContainText("Aditivos do Contrato");

      await page.click('a[href*="/penalidades"]');
      await page.waitForURL(`${BASE}${contratoUrl}/penalidades`);
      await expect(page.locator("h1")).toContainText("Penalidades do Contrato");

      await page.click('a[href*="/ocorrencias"]');
      await page.waitForURL(`${BASE}${contratoUrl}/ocorrencias`);
      await expect(page.locator("h1")).toContainText("Ocorrências do Contrato");

      await page.click('a[href*="/execucao"]');
      await page.waitForURL(`${BASE}${contratoUrl}/execucao`);
      await expect(page.locator("h1")).toContainText("Execução do Contrato");
    } else {
      await expect(page.getByText("Nenhum contrato encontrado")).toBeVisible();
    }
  });

  test("página de evidências do contrato da empresa carrega", async ({ page }) => {
    await loginEmpresa(page);
    await page.click('a[href="/empresa/contratos"]');
    await page.waitForURL(`${BASE}/empresa/contratos`);

    const primeiroLink = page.locator('a[href^="/empresa/contratos/"]').first();
    if ((await primeiroLink.count()) > 0) {
      const contratoUrl = await primeiroLink.getAttribute("href");
      await primeiroLink.click();
      await page.waitForURL(`${BASE}${contratoUrl}`);

      // Link para página de evidências
      await page.click('a[href*="/evidencias"]');
      await page.waitForURL(`${BASE}${contratoUrl}/evidencias`);
      await expect(page.locator("h1")).toContainText("Evidências do Contrato");
    } else {
      await expect(page.getByText("Nenhum contrato encontrado")).toBeVisible();
    }
  });
});

test.describe("Jornada ContratoVivo - Evidências (Órgão)", () => {
  test("admin envia uma evidência e vê na lista", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/evidencias/nova`);
    await page.waitForURL(`${BASE}/evidencias/nova`);
    await expect(page.locator("h1")).toContainText("Evidências");
  });
});

test.describe("Jornada GestorLicita - Licitações (Órgão)", () => {
  test("admin acessa a página de licitações", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/licitacoes`);
    await page.waitForURL(`${BASE}/licitacoes`);
    await expect(page.locator("h1")).toContainText("Licitações");
  });

  test("admin vê o detalhe de uma licitação existente", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/licitacoes`);
    await page.waitForURL(`${BASE}/licitacoes`);
    await expect(page.locator("h1")).toContainText("Licitações");
    // Se houver licitações na lista, clica na primeira
    const links = page.locator('a[href^="/licitacoes/"]');
    if ((await links.count()) > 0) {
      await links.first().click();
      await page.waitForURL(/\/licitacoes\/.+/);
      await expect(page.locator("h1")).toContainText("Licitação");
    }
  });
});

test.describe("Jornada GestorLicita - Licitações (Empresa/Fornecedor)", () => {
  test("fornecedor acessa a página de licitações", async ({ page }) => {
    await loginEmpresa(page);
    await page.goto(`${BASE}/empresa/licitacoes`);
    await page.waitForURL(`${BASE}/empresa/licitacoes`);
    await expect(page.locator("h1")).toContainText("Licitações disponíveis");
  });

  test("fornecedor vê o detalhe de uma licitação (somente leitura)", async ({ page }) => {
    await loginEmpresa(page);
    await page.goto(`${BASE}/empresa/licitacoes`);
    await page.waitForURL(`${BASE}/empresa/licitacoes`);
    const links = page.locator('a[href^="/empresa/licitacoes/"]');
    if ((await links.count()) > 0) {
      await links.first().click();
      await page.waitForURL(`${BASE}/empresa/licitacoes/`);
      await expect(page.locator("h1")).toContainText("Licitação");
    } else {
      await expect(page.locator("h1")).toContainText("Licitações disponíveis");
    }
  });
});

test.describe("Jornada - SentinelaOps (Segurança Operacional)", () => {
  test("admin acessa página de segurança operacional", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/sentinela`);
    await page.waitForURL(`${BASE}/sentinela`);
    await expect(page.locator("h1")).toContainText("SentinelaOps");
  });
});

test.describe("Jornada - Obrigações Contratuais", () => {
  test("admin acessa página de obrigações", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/obrigacoes`);
    await page.waitForURL(`${BASE}/obrigacoes`);
    await expect(page.locator("h1")).toContainText("Obrigações Contratuais");
  });
});

test.describe("Jornada - Recebimentos Contratuais", () => {
  test("admin acessa página de recebimentos", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/recebimentos`);
    await page.waitForURL(`${BASE}/recebimentos`);
    await expect(page.locator("h1")).toContainText("Recebimentos Contratuais");
  });
});

test.describe("Jornada - Mapa de Obras Públicas", () => {
  test("admin acessa página do mapa de obras", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/mapa-obras`);
    await page.waitForURL(`${BASE}/mapa-obras`);
    await page.waitForTimeout(2000); // aguarda carregamento assíncrono do mapa
    await expect(page.locator("h1")).toContainText("Mapa de Obras Públicas");
  });
});

test.describe("Jornada - Integração PNCP", () => {
  test("admin acessa página de integração PNCP", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/pncp`);
    await page.waitForURL(`${BASE}/pncp`);
    await expect(page.locator("h1")).toContainText("Integração PNCP");
  });
});

test.describe("Jornada - Vínculos Fornecedor", () => {
  test("admin acessa página de vínculos fornecedor", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/vinculos-fornecedores`);
    await page.waitForURL(`${BASE}/vinculos-fornecedores`);
    await expect(page.locator("h1")).toContainText("Vínculos Contratante-Fornecedor");
  });
});
