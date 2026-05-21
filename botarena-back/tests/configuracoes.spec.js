const { test, expect } = require('@playwright/test');

test.describe('Configurações Menu', () => {
    test('Deve preencher configurações de Pix e Horário de Atendimento', async ({ page }) => {
        const backendUrl = 'http://localhost:3000';
        
        // 1. Acessa o login
        await page.goto(`${backendUrl}/index.html`);
        await page.fill('#email', 'teste');
        await page.fill('#password', '12345');
        await page.click('#submit-btn');

        // Aguarda carregar e ir para o dashboard ou painel administrativo
        await expect(page).toHaveURL(/.*(dashboard|painel-administrativo).*/, { timeout: 5000 });

        // 2. Abre a aba de configurações na sidebar
        await page.click('[data-tab="settings"]');
        
        // Localiza o iframe de configurações
        const iframe = page.frameLocator('#main-iframe');

        // 1. Preenchimento dos dados do Pix dentro do iframe
        await iframe.locator('#cfg-pix-name').fill('Arena Juvenal LTDA');
        await iframe.locator('#cfg-pix-key').fill('contato@arenajuvenal.com.br');

        // 2. Adição de um novo período de atendimento dentro do iframe
        await iframe.locator('#btn-add-period').click();

        // Seleciona alguns dias (ex: Seg, Ter, Qua) no primeiro período inserido
        const firstPeriod = iframe.locator('.operation-period-block').first();
        await firstPeriod.locator('.day-pill[data-day="1"]').click(); // Seg
        await firstPeriod.locator('.day-pill[data-day="2"]').click(); // Ter
        await firstPeriod.locator('.day-pill[data-day="3"]').click(); // Qua
        
        // Preenche horário
        await firstPeriod.locator('.period-start').fill('10:00');
        await firstPeriod.locator('.period-end').fill('14:00');

        // Adiciona um segundo período
        await iframe.locator('#btn-add-period').click();
        const secondPeriod = iframe.locator('.operation-period-block').nth(1);
        await secondPeriod.locator('.day-pill[data-day="6"]').click(); // Sáb
        await secondPeriod.locator('.period-start').fill('18:00');
        await secondPeriod.locator('.period-end').fill('22:00');

        // 3. Preenchimento de uma mensagem de ausência dentro do iframe
        await iframe.locator('#cfg-op-absence').fill('Estamos fora do horário de atendimento. Retornaremos em breve.');

        // 4. Salva as configurações dentro do iframe
        await iframe.locator('[data-testid="btn-save-config"]').click();

        // Tira um print para evidência
        await page.screenshot({ path: 'qa-evidence/settings_menu_test.png', fullPage: true });
        // console.log('✅ Teste de configurações concluído com sucesso!');
    });
});
