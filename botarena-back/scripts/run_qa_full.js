const { execSync } = require('child_process');

function runQA(runE2E = false) {
    console.log("🚀 [1/5] Syntax Check (Node --check)");
    execSync('node --check server.js src/routes/api.js src/container.js', { stdio: 'inherit' });

    console.log("🚀 [2/5] Teste de Código (Incremental)");
    execSync('npm run teste-codigo', { stdio: 'inherit' });

    console.log("🚀 [3/5] Teste de Segurança (Doom Test)");
    execSync('npm run teste-seg', { stdio: 'inherit' });

    console.log("🚀 [4/5] Testes Unitários (Jest)");
    execSync('npm run test', { stdio: 'inherit' });

    console.log("🚀 [5/5] Testes de Banco e Infra");
    execSync('npm run teste-banco', { stdio: 'inherit' });

    if (runE2E) {
        console.log("🚀 [EXTRA] Executando E2E Completo (Playwright)...");
        execSync('npx playwright test tests/visual_sync.spec.js', { stdio: 'inherit' });
    } else {
        console.log("⚠️ E2E pulado por segurança. Rode com '--full' para executar.");
    }

    console.log("\n✅ QA Completo! Todos os testes passaram.");
}

const runFull = process.argv.includes('--full');
runQA(runFull);
