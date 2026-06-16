const { test, expect } = require('@playwright/test');

test('Client and Delivery Fee Sync & Validation Verification', async ({ page }) => {
    console.log('--- Iniciando Teste de Sincronização Clientes <-> Taxas de Entrega ---');
    
    // Log all console events from browser
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Auto-dismiss dialogs and print them
    const dialogMessages = [];
    page.on('dialog', async dialog => {
        console.log(`PAGE DIALOG: [${dialog.type()}] - ${dialog.message()}`);
        dialogMessages.push(dialog.message());
        await dialog.dismiss();
    });

    const backendUrl = 'http://localhost:3000';

    // 1. Efetuar Login
    await page.goto(`${backendUrl}/index.html`);
    await page.fill('#email', 'teste');
    await page.fill('#password', '12345');
    await page.click('#submit-btn');
    
    // Esperar redirecionamento para o painel administrativo
    await expect(page).toHaveURL(/.*painel-administrativo.*/, { timeout: 5000 });

    // 2. Navegar diretamente para clientes.html (já logado)
    await page.goto(`${backendUrl}/clientes.html`);
    await page.waitForTimeout(500);

    // 3. Cadastrar um novo cliente com CEP e Número
    // Clica no botão de novo cliente
    await page.click('#btn-new-client');
    await page.waitForSelector('#modal-registration.active', { timeout: 2000 });

    // Preenche os dados do cliente
    const testName = 'Cliente Teste Sync ' + Date.now();
    const testPhone = '551799' + Math.floor(1000000 + Math.random() * 9000000);
    const testAddress = 'Avenida Brigadeiro Luis Antonio';
    const testNumber = '1000';
    const testCEP = '01318-001';
    const testNeighborhood = 'Bela Vista';

    await page.fill('#client-name', testName);
    await page.fill('#client-phone', testPhone);
    await page.fill('#client-cep', testCEP);
    await page.fill('#client-neighborhood', testNeighborhood);
    await page.fill('#client-address', `${testAddress}, ${testNumber}`);

    // Enviar formulário
    await page.click('#btn-submit');
    await expect(page.locator('#modal-registration')).not.toHaveClass(/active/, { timeout: 5000 });

    // 4. Verificar se o cliente foi adicionado na tabela de clientes
    const tableText = await page.innerText('#clients-table-body');
    expect(tableText).toContain(testName);
    expect(tableText).toContain(`${testAddress}, ${testNumber}`);
    expect(tableText).toContain(testNeighborhood);
    expect(tableText).toContain(testCEP);

    // 5. Navegar de volta para painel-administrativo.html e verificar se a taxa foi criada com R$ 0,00 e o endereço correspondente
    await page.goto(`${backendUrl}/painel-administrativo.html`);
    
    // Garante que o grupo 'group-delivery' está expandido na sidebar
    const groupDelivery = page.locator('#group-delivery');
    const isCollapsed = await groupDelivery.evaluate(el => el.classList.contains('collapsed'));
    if (isCollapsed) {
        await page.click('#group-delivery .sidebar__group-header');
        await page.waitForTimeout(300);
    }
    
    // Navega para a aba de taxas de entrega
    await page.click('[data-tab="delivery-fee"]');
    await page.waitForSelector('#delivery-fees-table-body', { timeout: 5000 });

    // Esperar um pouco para a tabela carregar os dados atualizados da API
    await page.waitForTimeout(1000);
    const rawTableText = await page.innerText('#delivery-fees-table-body');
    // Normaliza non-breaking spaces (\u00a0) gerados por formatação de moeda
    const deliveryTableText = rawTableText.replace(/\u00a0/g, ' ');
    
    // O CEP sincronizado deve constar na tabela de taxas
    expect(deliveryTableText).toContain('01318-001');
    expect(deliveryTableText).toContain('Avenida Brigadeiro Luis Antonio');
    expect(deliveryTableText).toContain('R$ 0,00');

    // 6. Testar cadastro de taxa duplicada diretamente e garantir validação do frontend/backend
    await page.click('#btn-add-delivery-fee');
    await page.waitForSelector('#modal-delivery-fee', { state: 'visible', timeout: 2000 });

    await page.locator('#delivery-neighborhood').evaluate(el => el.value = 'Outra Regiao');
    await page.fill('#delivery-zip-code', '01318-001'); // CEP duplicado
    await page.fill('#delivery-distance', '10.0'); // Preenche distância que agora é obrigatória
    await page.fill('#delivery-fee-value', '12.50');

    await page.click('#form-delivery-fee button[type="submit"]');
    
    // Esperar o alert ou erro de CEP duplicado
    await page.waitForTimeout(1500);
    const hasDupMsg = dialogMessages.some(m => m.includes('CEP já cadastrado'));
    expect(hasDupMsg).toBe(true);

    // Fecha o modal de taxas
    await page.click('#btn-close-delivery-modal');
    console.log('--- Teste concluído com sucesso! ---');
});
