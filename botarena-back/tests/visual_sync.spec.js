const { test, expect } = require('@playwright/test');

test('Visual Sync & Story Filter Verification', async ({ page }) => {
    // console.log('--- Iniciando Simulação Visual (Playwright) ---');

    const backendUrl = 'http://localhost:3000';
    
    // 1. Perform login
    await page.goto(`${backendUrl}/index.html`);
    await page.fill('#email', 'teste');
    await page.fill('#password', '12345');
    await page.click('#submit-btn');
    
    // Expect to land on the dashboard or admin panel
    await expect(page).toHaveURL(/.*(dashboard|painel-administrativo).*/, { timeout: 5000 });

    // 2. Go to Atendimento (chat UI) via the header action button
    await page.click('button[title="Ir para Atendimento"]');
    
    // Expect URL to transition to /atendimento
    await expect(page).toHaveURL(/.*atendimento.*/, { timeout: 5000 });

    // 3. We wait a moment for everything to settle
    await page.waitForTimeout(1000); 

    // Verify Status/Story item is NOT present in contact list
    const storyItem = page.locator('[data-testid="chat-item-story"]');
    await expect(storyItem).toHaveCount(0);

    // Verify chat input is disabled initially when no conversation is selected
    const chatInput = page.locator('.chat-input');
    await expect(chatInput).toBeDisabled();

    // 4. Take the visual screenshot
    await page.screenshot({ path: 'qa-evidence/last_test_state.png', fullPage: true });
});
