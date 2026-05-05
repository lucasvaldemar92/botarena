const { test, expect } = require('@playwright/test');

test.describe('Configurações Menu', () => {
    test('Deve preencher configurações de Pix e Horário de Atendimento', async ({ page }) => {
        const backendUrl = 'http://localhost:3000';
        
        // Acessa o dashboard
        await page.goto(`${backendUrl}/dashboard`);
        
        // Aguarda carregar
        await page.waitForTimeout(1000);

        // Abre o modal de configurações
        await page.click('[data-testid="open-settings"]');
        
        // Aguarda o modal ficar visível
        const modal = page.locator('[data-testid="settings-modal"]');
        await expect(modal).toBeVisible();

        // 1. Preenchimento dos dados do Pix
        await page.fill('#cfg-pix-name', 'Arena Juvenal LTDA');
        await page.fill('#cfg-pix-key', 'contato@arenajuvenal.com.br');

        // 2. Adição de um novo período de atendimento
        await page.click('#btn-add-period');

        // Seleciona alguns dias (ex: Seg, Ter, Qua) no primeiro período inserido
        // O JS injeta o período com botões .day-pill
        const firstPeriod = page.locator('.operation-period').first();
        if (await firstPeriod.count() > 0) {
            await firstPeriod.locator('.day-pill[data-day="1"]').click(); // Seg
            await firstPeriod.locator('.day-pill[data-day="2"]').click(); // Ter
            await firstPeriod.locator('.day-pill[data-day="3"]').click(); // Qua
            
            // Preenche horário
            await firstPeriod.locator('.period-start').fill('10:00');
            await firstPeriod.locator('.period-end').fill('14:00');
        }

        // Adiciona um segundo período (baseado na segunda imagem do usuário)
        await page.click('#btn-add-period');
        const secondPeriod = page.locator('.operation-period').nth(1);
        if (await secondPeriod.count() > 0) {
            await secondPeriod.locator('.day-pill[data-day="6"]').click(); // Sáb
            await secondPeriod.locator('.period-start').fill('18:00');
            await secondPeriod.locator('.period-end').fill('22:00');
        }

        // 3. Preenchimento de uma mensagem de ausência
        await page.fill('#cfg-op-absence', 'Estamos fora do horário de atendimento. Retornaremos em breve.');

        // 4. Salva as configurações
        await page.click('[data-testid="btn-save-config"]');

        // Abre o inspetor do Playwright para o usuário interagir
        await page.pause();

        // Tira um print para evidência
        await page.screenshot({ path: 'qa-evidence/settings_menu_test.png', fullPage: true });
        console.log('✅ Teste de configurações concluído com sucesso!');
    });
});
