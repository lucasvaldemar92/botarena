const { test, expect } = require('@playwright/test');

test('Visual Sync & Story Filter Verification', async ({ page }) => {
    console.log('--- Iniciando Simulação Visual (Playwright) ---');

    const backendUrl = 'http://localhost:3000';
    
    // 1. Navigate to the dashboard. 
    // Given the previous sprint, if we are authenticated, this should instantly bypass to /chat.
    await page.goto(`${backendUrl}/dashboard`);

    // Wait for the state transition from 'Connected' to 'Chat UI' within 5s.
    // The redirect happens quickly; we expect the URL to include 'chat'
    await expect(page).toHaveURL(/.*chat.*/, { timeout: 5000 });
    console.log('✅ Redirecionamento instantâneo testado e aprovado! Bypass operante.');

    // 2. We wait a moment for everything to settle
    await page.waitForTimeout(1000); 

    // Task 3: Visual E2E "Story-Proof" Test
    console.log('🔄 SImulando clique no Story/Status...');
    await page.click('[data-testid="chat-item-story"]');
    await page.waitForTimeout(500);

    // Try to type
    const chatInput = page.locator('.chat-input');
    const btnSend = page.locator('[data-testid="send-message-btn"]');
    
    // Assertions
    await expect(chatInput).toBeDisabled();
    if (await btnSend.count() > 0) {
        await expect(btnSend).toBeDisabled();
    }
    await expect(chatInput).toHaveAttribute('placeholder', /Não é permitido/);
    console.log('✅ UI Context Lock validado: Botão e Input desabilitados!');

    // 3. Take the visual screenshot
    await page.screenshot({ path: 'qa-evidence/last_test_state.png', fullPage: true });
    console.log('📸 Visual Evidence capturada em: qa-evidence/last_test_state.png');
});
