const { test, expect } = require('@playwright/test');

// Função auxiliar para garantir que um grupo de abas da sidebar está expandido
async function ensureGroupExpanded(page, groupId) {
    const group = page.locator(`#${groupId}`);
    const isCollapsed = await group.evaluate(el => el.classList.contains('collapsed'));
    if (isCollapsed) {
        await page.click(`#${groupId} .sidebar__group-header`);
        // Aguarda transição do colapso no layout CSS
        await page.waitForTimeout(300);
    }
}

test.describe('Painel Administrativo - Novas Telas & Integrações', () => {
    const backendUrl = 'http://localhost:3000';

    test.beforeEach(async ({ page }) => {
        // 1. Efetuar Login para entrar na sessão do Painel
        await page.goto(`${backendUrl}/index.html`);
        await page.fill('#email', 'teste');
        await page.fill('#password', '12345');
        await page.click('#submit-btn');

        // Garantir redirecionamento
        await expect(page).toHaveURL(/.*(dashboard|painel-administrativo).*/, { timeout: 10000 });
    });

    test('Deve validar a tela de Integrações, alterar status badges e persistir dados', async ({ page }) => {
        // 1. Garantir que o grupo 'group-bot' de integrações está expandido
        await ensureGroupExpanded(page, 'group-bot');

        // 2. Navegar para a aba de Integrações
        await page.click('[data-tab="integrations"]');
        
        // Espera a seção nativa de Integrações ficar ativa e visível
        const aiSection = page.locator('#view-integrations');
        await expect(aiSection).toBeVisible();

        // 3. Validar que os campos de OpenAI e Gemini estão presentes
        const openaiKeyInput = page.locator('#openai-api-key');
        const geminiKeyInput = page.locator('#gemini-api-key');
        await expect(openaiKeyInput).toBeVisible();
        await expect(geminiKeyInput).toBeVisible();

        // 4. Testar a alternância (click) nos badges de status
        const openaiBadge = page.locator('#openai-status-badge');
        
        // Armazena estado original para teste de toggle
        const initialOpenaiActive = await openaiBadge.getAttribute('data-active');
        const targetOpenaiActive = initialOpenaiActive === 'true' ? 'false' : 'true';

        // Clica para alternar
        await openaiBadge.click();
        await expect(openaiBadge).toHaveAttribute('data-active', targetOpenaiActive);

        // Preenche novas chaves temporárias para teste
        const testOpenaiKey = 'sk-proj-testplaywright12345';
        const testGeminiKey = 'AIzaSy-testplaywrightgemini999';
        await openaiKeyInput.fill(testOpenaiKey);
        await geminiKeyInput.fill(testGeminiKey);

        // 5. Salvar as Integrações
        const saveBtn = page.locator('#btn-save-integrations');
        await saveBtn.click();
        
        // Verifica se exibiu feedback de salvo
        await expect(saveBtn).toContainText('Salvo!');

        // 6. Recarregar e validar persistência
        await page.reload();
        
        // Garante o menu aberto novamente após recarregar
        await ensureGroupExpanded(page, 'group-bot');
        await page.click('[data-tab="integrations"]');
        
        await expect(openaiKeyInput).toHaveValue(testOpenaiKey);
        await expect(geminiKeyInput).toHaveValue(testGeminiKey);
        await expect(openaiBadge).toHaveAttribute('data-active', targetOpenaiActive);
    });

    test('Deve validar o carregamento da aba Clientes através de iframe', async ({ page }) => {
        // 1. Clientes está na raiz do menu lateral (sem grupo colapsável), clicamos diretamente
        await page.click('[data-tab="clientes"]');

        // 2. Aguarda carregar o contêiner do iframe
        const iframeContainer = page.locator('#view-iframe-container');
        await expect(iframeContainer).toBeVisible();

        // 3. Aguarda o iframe carregar internamente e o JS inicializar
        await page.waitForTimeout(1500);

        // 4. Obtém o locator do iframe e valida se elementos internos estão visíveis
        const iframe = page.frameLocator('#main-iframe');
        const btnNewClient = iframe.locator('#btn-new-client');
        await expect(btnNewClient).toBeVisible({ timeout: 10000 });

        // Abre modal de novo cliente no iframe
        await btnNewClient.click();
        
        // Aguarda transição do modal
        const modalTitle = iframe.locator('#modal-title');
        await expect(modalTitle).toBeVisible({ timeout: 5000 });
        await expect(modalTitle).toContainText('Cadastro de Cliente');
    });

    test('Deve validar o carregamento da aba Pedidos através de iframe', async ({ page }) => {
        // 1. Garantir que o grupo 'group-delivery' está expandido
        await ensureGroupExpanded(page, 'group-delivery');

        // 2. Navegar para a aba Pedidos
        await page.click('[data-tab="pedidos"]');

        // 3. Aguarda carregar o contêiner do iframe
        const iframeContainer = page.locator('#view-iframe-container');
        await expect(iframeContainer).toBeVisible();

        // 4. Aguarda o iframe carregar internamente e o JS inicializar
        await page.waitForTimeout(1500);

        // 5. Obtém o locator do iframe e valida se elementos internos do dashboard de pedidos estão visíveis
        const iframe = page.frameLocator('#main-iframe');
        const statusGrid = iframe.locator('.status-grid');
        await expect(statusGrid).toBeVisible({ timeout: 10000 });

        const countNovo = iframe.locator('#count-novo');
        await expect(countNovo).toBeVisible();
    });
});
