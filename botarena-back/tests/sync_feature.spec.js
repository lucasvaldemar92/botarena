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

    await page.fill('#client-name', testName);
    await page.fill('#client-phone', testPhone);
    await page.fill('#client-cep', testCEP);
    await page.fill('#client-address', testAddress);
    await page.fill('#client-number', testNumber);

    // Enviar formulário
    await page.click('#btn-submit');
    await page.waitForSelector('#modal-registration:not(.active)', { timeout: 4000 });

    // 4. Verificar se o cliente foi adicionado na tabela de clientes
    const tableText = await page.innerText('#clients-table-body');
    expect(tableText).toContain(testName);
    expect(tableText).toContain(testAddress);
    expect(tableText).toContain(testNumber);
    expect(tableText).toContain(testCEP);

    // 5. Navegar de volta para painel-administrativo.html e verificar se a taxa foi criada com R$ 0,00 e o endereço correspondente
    await page.goto(`${backendUrl}/painel-administrativo.html`);
    await page.waitForSelector('#delivery-fees-table-body', { timeout: 5000 });

    // Esperar um pouco para a tabela carregar os dados atualizados da API
    await page.waitForTimeout(1000);
    const deliveryTableText = await page.innerText('#delivery-fees-table-body');
    
    // O CEP sincronizado deve constar na tabela de taxas
    expect(deliveryTableText).toContain('01318-001');
    expect(deliveryTableText).toContain('Avenida Brigadeiro Luis Antonio');
    expect(deliveryTableText).toContain('R$ 0,00');

    // 6. Testar cadastro de taxa duplicada diretamente e garantir validação do frontend/backend
    await page.click('#btn-add-delivery-fee');
    await page.waitForSelector('#modal-delivery-fee', { state: 'visible', timeout: 2000 });

    await page.fill('#delivery-neighborhood', 'Outra Regiao');
    await page.fill('#delivery-zip-code', '01318-001'); // CEP duplicado
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
