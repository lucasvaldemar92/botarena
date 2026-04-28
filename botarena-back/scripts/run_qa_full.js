const { execSync } = require('child_process');

function runQA(runE2E = false) {
    console.log("🚀 Iniciando QA... [1/3] Testes Unitários (Jest)");
    execSync('npm run test', { stdio: 'inherit' });

    console.log("🚀 [2/3] Testes de Banco e Infra");
    execSync('npm run teste-banco', { stdio: 'inherit' });

    if (runE2E) {
        console.log("🚀 [3/3] Executando E2E Completo (Playwright)...");
        execSync('npx playwright test', { stdio: 'inherit' });
    } else {
        console.log("⚠️ E2E pulado por segurança. Rode com '--full' para executar.");
    }
}

const runFull = process.argv.includes('--full');
runQA(runFull);
