const { execSync } = require('child_process');
const fs = require('fs');

console.log('--- Iniciando Teste de Código Incremental (Serverless) ---');
const start = performance.now();

try {
    // Pega arquivos modificados e não commitados, ou arquivos staged
    // Executa na raiz do botarena-back (mas o repositório principal é no nível pai)
    let diff = '';
    try {
        diff = execSync('git diff --name-only HEAD', { cwd: '..' }).toString().trim();
    } catch(e) {
        console.log('✅ Git branch nova ou sem HEAD. Prosseguindo.');
    }

    if (!diff) {
        console.log('✅ Nenhum arquivo modificado. Status: Verde Limpo.');
        const end = performance.now();
        console.log(`⏱️ Tempo: ${(end - start).toFixed(2)}ms`);
        process.exit(0);
    }
    
    const jsFiles = diff.split('\n')
        .filter(f => f.endsWith('.js') && f.includes('botarena-back/'))
        .map(f => f.split('botarena-back/')[1]);
    
    if (jsFiles.length === 0) {
         console.log('✅ Nenhuma modificação em arquivos .js no escopo atual. Status: Verde Limpo.');
         const end = performance.now();
         console.log(`⏱️ Tempo: ${(end - start).toFixed(2)}ms`);
         process.exit(0);
    }
    
    console.log(`🔍 Analisando ${jsFiles.length} arquivo(s) modificado(s)...`);
    
    let hasError = false;
    jsFiles.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                // Check sintaxe JS nativamente
                execSync(`node --check "${file}"`, { stdio: 'ignore' });
            } catch (e) {
                console.error(`❌ Erro de Sintaxe em: ${file}`);
                hasError = true;
            }
        }
    });

    if (hasError) {
        console.error('❌ Compilação falhou no incremental QA.');
        process.exit(1);
    }

    const end = performance.now();
    console.log('✅ Lint Incremental Aprovado em todos os modificados!');
    console.log(`⏱️ Tempo: ${(end - start).toFixed(2)}ms`);
} catch (error) {
    console.error('❌ Falha na execução da engine de Código:', error.message);
    process.exit(1);
}
