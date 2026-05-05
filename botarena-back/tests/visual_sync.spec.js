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

    // Task 3: Verify Status/Story item is NOT present in contact list
    console.log('🔄 Verificando ausência do item Status na lista...');
    const storyItem = page.locator('[data-testid="chat-item-story"]');
    await expect(storyItem).toHaveCount(0);
    console.log('✅ Status (Contato) ausente da lista — filtro de status operante!');

    // Verify chat input is functional (not locked)
    const chatInput = page.locator('.chat-input');
    await expect(chatInput).toBeEnabled();
    console.log('✅ Chat input habilitado e funcional.');

    // 3. Take the visual screenshot
    await page.screenshot({ path: 'qa-evidence/last_test_state.png', fullPage: true });
    console.log('📸 Visual Evidence capturada em: qa-evidence/last_test_state.png');
});
