const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([
    { name: 'sessao_usr_id', value: '00000000-0000-0000-0000-000000000001', url: 'http://localhost:3000' },
    { name: 'sessao_org_id', value: '00000000-0000-0000-0000-000000000002', url: 'http://localhost:3000' },
    { name: 'sessao_papel', value: 'fiscal', url: 'http://localhost:3000' }
  ]);
  const page = await context.newPage();
  await page.goto('http://localhost:3000/inicio');
  await page.screenshot({ path: 'C:/dev/contratacao-publica/screenshot.png', fullPage: true });
  await browser.close();
  console.log('Screenshot salva');
})();