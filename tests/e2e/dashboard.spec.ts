import { test, expect } from '@playwright/test';
test('protege dashboard e API sem autenticação', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
  const response = await request.get('/api/data?resource=stock', { maxRedirects: 0 });
  expect(response.status()).toBe(401);
  expect(response.headers()['content-type']).toContain('application/json');
});
test('dashboard segue estrutura e filtros funcionam', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Farmácia UPA RM' })).toBeVisible();
  await expect(page.getByText('Produtos monitorados', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Prévia da importação' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Status dos produtos' })).toBeVisible();
  await page.getByRole('button', { name: 'Estoque', exact: true }).click();
  await page.getByLabel('Pesquisar estoque').fill('AZITROMICINA');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'AZITROMICINA', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await page.getByLabel('Filtrar situação').selectOption('ZERADO');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText('SALBUTAMOL', { exact: true })).toBeVisible();
});
test('revisão manual exige justificativa e confirmação', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Revisar todas as pendências' }).click();
  await page.getByRole('button', { name: 'Revisar', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Justificativa da decisão')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('menus, detalhes e relatórios acessíveis', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Consolidado' })).toBeVisible();
  await page.getByRole('button', { name: 'DE-PARA', exact: true }).click();
  await expect(page.getByText('EPINEFRINA 1 mg/mL 1 mL', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cadastros', exact: true }).click();
  await page.getByRole('button', { name: 'Novo medicamento' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
test('layout tablet e celular sem transbordamento da página', async ({ page }) => {
  for (const width of [1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: 'Farmácia UPA RM' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
