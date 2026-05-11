const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration & Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(PROJECT_ROOT, 'qa-evidence');
const SCORES_FILE = path.join(EVIDENCE_DIR, 'scores.json');
const REPORT_FILE = path.join(EVIDENCE_DIR, 'report_latest.html');

// Categories Definition
const categories = [
    { id: '01', name: 'SEGURANÇA', score: 100, details: [] },
    { id: '02', name: 'BANCO DE DADOS', score: 100, details: [] },
    { id: '03', name: 'QUALIDADE', score: 100, details: [] },
    { id: '04', name: 'COBERTURA', score: 100, details: [] },
    { id: '05', name: 'CONSISTÊNCIA API', score: 100, details: [] },
    { id: '06', name: 'FRONTEND PT-BR', score: 100, details: [] },
    { id: '07', name: 'DEPENDÊNCIAS', score: 100, details: [] }
];

function addIssue(catId, type, message, penalty = 0) {
    const cat = categories.find(c => c.id === catId);
    if (cat) {
        cat.details.push({ type, message });
        cat.score -= penalty;
        if (cat.score < 0) cat.score = 0;
    }
}

// --- 01 SEGURANÇA ---
function scanSecurity() {
    const handlerDir = path.join(PROJECT_ROOT, 'botarena-back', 'src', 'handlers');
    const handlers = getFiles(handlerDir, ['.js']);
    
    let protectionCoverage = 0;
    const totalHandlers = handlers.length;

    handlers.forEach(f => {
        const content = fs.readFileSync(f, 'utf8');
        const hasFromMe = content.includes('fromMe');
        const hasIsStatus = content.includes('isStatus') || content.includes('status@broadcast');
        
        if (hasFromMe && hasIsStatus) protectionCoverage++;
        
        if (!hasFromMe) addIssue('01', 'WARN', `Handler vulnerável a loop (sem fromMe): ${path.basename(f)}`, 5);
        if (!hasIsStatus) addIssue('01', 'WARN', `Handler processando Status (sem isStatus): ${path.basename(f)}`, 5);
        
        if (content.includes('Bearer ') && !content.includes('process.env')) {
            addIssue('01', 'ERROR', `Token crítico exposto em: ${path.basename(f)}`, 20);
        }
    });

    if (totalHandlers > 0 && protectionCoverage / totalHandlers < 0.8) {
        addIssue('01', 'ERROR', 'Cobertura de proteção global abaixo de 80%. Risco de loop detectado.', 10);
    }
}

// --- 02 BANCO DE DADOS ---
function scanDatabase() {
    const setupPath = path.join(PROJECT_ROOT, 'execution', 'ci_setup_db.js');
    if (!fs.existsSync(setupPath)) {
        addIssue('02', 'ERROR', 'ci_setup_db.js não encontrado na pasta execution/.', 20);
    }
    
    const handlerDir = path.join(PROJECT_ROOT, 'botarena-back', 'src', 'handlers');
    const handlers = getFiles(handlerDir, ['.js']);
    
    handlers.forEach(f => {
        const content = fs.readFileSync(f, 'utf8');
        // Regra: Handlers não devem importar 'database' ou 'prisma' diretamente, apenas Repositories
        if (content.includes("require('../database')") || content.includes("from '../database'")) {
            addIssue('02', 'ERROR', `Acesso direto ao banco no handler: ${path.basename(f)}. Use Repositories.`, 15);
        }
    });
}

// --- 03 QUALIDADE ---
function scanQuality() {
    const backDir = path.join(PROJECT_ROOT, 'botarena-back');
    const files = getFiles(backDir, ['.js']);

    files.forEach(f => {
        const filename = path.basename(f);
        if (filename.includes('prettify') || f.includes('assets') || f.includes('vendor')) return;

        // 1. Syntax Check (Sanity)
        try {
            execSync(`node --check "${f}"`, { stdio: 'ignore' });
        } catch (e) {
            addIssue('03', 'ERROR', `Erro de SINTAXE detectado: ${path.basename(f)}`, 50);
        }

        const content = fs.readFileSync(f, 'utf8');
        const lines = content.split('\n');
        
        // Tamanho do arquivo
        if (lines.length > 300) {
            addIssue('03', 'WARN', `Arquivo muito extenso: ${path.basename(f)} (${lines.length} linhas).`, 5);
        }
        
        // Tamanho de funções (Heurística simples via indentação e blocos)
        const functions = content.match(/function.*?\{|async.*?\{|=>.*?\{/g) || [];
        if (functions.length > 0) {
            // Se o arquivo tem muitas linhas e poucas funções, as funções são provavelmente longas
            if (lines.length / functions.length > 80) {
                addIssue('03', 'WARN', `Possível violação de Single Responsibility em ${path.basename(f)}.`, 5);
            }
        }

        const consoleLogs = lines.filter(line => {
            const trimmed = line.trim();
            return trimmed.includes('console.log') && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
        }).length;

        if (consoleLogs > 5) {
            addIssue('03', 'WARN', `Excesso de logs de depuração (${consoleLogs}) em: ${path.basename(f)}`, 5);
        }
    });
}

// --- 04 COBERTURA ---
function scanCoverage() {
    const handlerDir = path.join(PROJECT_ROOT, 'botarena-back', 'src', 'handlers');
    const testDir = path.join(PROJECT_ROOT, 'botarena-back', 'tests');
    
    if (fs.existsSync(handlerDir)) {
        const handlers = fs.readdirSync(handlerDir).filter(f => f.endsWith('.js'));
        handlers.forEach(h => {
            // Busca recursiva pelo arquivo de teste correspondente
            const testFiles = getFiles(testDir, ['.js', '.ts']);
            const hasTest = testFiles.some(f => f.toLowerCase().includes(h.replace('.js', '').toLowerCase()));
            
            if (!hasTest) {
                addIssue('04', 'WARN', `Handler órfão de testes: ${h}. Crie um arquivo em tests/ para validar o fluxo.`, 5);
            }
        });
    }
}

// --- 05 CONSISTÊNCIA API ---
function scanAPI() {
    const backDir = path.join(PROJECT_ROOT, 'botarena-back');
    const schemaDir = path.join(backDir, 'src', 'schemas');
    const files = getFiles(backDir, ['.js']);
    
    let usesZod = false;
    if (fs.existsSync(schemaDir)) {
        const schemas = fs.readdirSync(schemaDir);
        if (schemas.length > 0) usesZod = true;
    }

    files.forEach(f => {
        const content = fs.readFileSync(f, 'utf8');
        if (content.includes('zod') || content.includes('Schema')) usesZod = true;
        
        // Verifica padrão de resposta JSON
        if (content.includes('res.json(') || content.includes('res.send(')) {
            if (!content.includes('success:') && !content.includes('error:')) {
                addIssue('05', 'WARN', `Resposta não padronizada detectada em: ${path.basename(f)}`, 5);
            }
        }
    });

    if (!usesZod) addIssue('05', 'ERROR', 'Ausência crítica de esquemas de validação (Zod) nas rotas de escrita.', 15);
}

// --- 06 FRONTEND PT-BR ---
function scanFrontend() {
    const frontDir = path.join(PROJECT_ROOT, 'botarena-front');
    const files = getFiles(frontDir, ['.html', '.js']);
    const englishWords = ['Search', 'Type a message', 'Contact Info', 'Settings', 'Logout', 'Loading', 'Chat'];

    files.forEach(f => {
        const content = fs.readFileSync(f, 'utf8');
        englishWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'g');
            if (content.includes(`>${word}<`) || content.includes(`placeholder="${word}"`) || (f.endsWith('.js') && content.includes(`'${word}'`))) {
                addIssue('06', 'WARN', `Termo em inglês detectado: "${word}" em ${path.basename(f)}`, 5);
            }
        });

        // UI PURGE CHECK (Layer 2 Governance)
        if (f.endsWith('chat.html')) {
            if (content.includes('fa-video')) addIssue('06', 'ERROR', 'Elemento proibido (PURGE): Chamada de Vídeo encontrada no DOM.', 20);
            if (content.includes('fa-phone')) addIssue('06', 'ERROR', 'Elemento proibido (PURGE): Chamada de Voz encontrada no DOM.', 20);
            // Busca no Chat (fa-magnifying-glass) -> PRESERVE (OK)
        }
    });
}

// --- 07 DEPENDÊNCIAS ---
function scanDependencies() {
    const backDir = path.join(PROJECT_ROOT, 'botarena-back');
    const pkgPath = path.join(backDir, 'package.json');
    
    if (!fs.existsSync(pkgPath)) {
        addIssue('07', 'ERROR', 'package.json não encontrado no backend.', 20);
        return;
    }

    // 1. Check npm audit
    try {
        const audit = execSync('npm audit --json', { cwd: backDir, stdio: 'pipe' }).toString();
        const auditData = JSON.parse(audit);
        const critical = auditData.metadata.vulnerabilities.critical || 0;
        const high = auditData.metadata.vulnerabilities.high || 0;
        
        if (critical > 0) addIssue('07', 'ERROR', `Vulnerabilidades CRÍTICAS detectadas: ${critical}`, 20);
        if (high > 0) addIssue('07', 'WARN', `Vulnerabilidades de alto risco detectadas: ${high}`, 10);
    } catch (e) {
        // npm audit exits with code > 0 if issues found
    }

    // 2. Check for orphan/unused packages (Basic Check)
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = Object.keys(pkg.dependencies || {});
    const srcFiles = getFiles(path.join(backDir, 'src'), ['.js']);
    const rootFiles = fs.readdirSync(backDir)
        .filter(f => f.endsWith('.js'))
        .map(f => path.join(backDir, f));
    
    const allFiles = [...srcFiles, ...rootFiles];
    const allContent = allFiles.map(f => fs.readFileSync(f, 'utf8')).join(' ');

    deps.forEach(d => {
        const regex = new RegExp(`(require|from)\\s*\\(['"\`]${d}['"\`]\\)|['"\`]${d}['"\`]`, 'g');
        if (!regex.test(allContent)) {
            // Alguns pacotes podem ser usados via binários ou middlewares injetados, então apenas WARN
            addIssue('07', 'WARN', `Pacote possivelmente órfão (não importado no src): ${d}`, 5);
        }
    });
}

// Helper: Get files recursively
function getFiles(dir, exts) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules')) results = results.concat(getFiles(file, exts));
        } else {
            if (exts.includes(path.extname(file))) results.push(file);
        }
    });
    return results;
}

// Execution
async function run() {
    if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR);

    let currentBranch = 'unknown';
    try {
        currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    } catch (e) {
        // Not a git repo or git not installed
    }

    scanSecurity();
    scanDatabase();
    scanQuality();
    scanCoverage();
    scanAPI();
    scanFrontend();
    scanDependencies();

    const totalScore = Math.round(categories.reduce((acc, c) => acc + c.score, 0) / categories.length);
    
    // Persist Score
    let history = [];
    if (fs.existsSync(SCORES_FILE)) {
        history = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
    }
    const lastScore = history.length > 0 ? history[history.length - 1].score : totalScore;
    history.push({ date: new Date().toISOString(), score: totalScore, categories: categories.map(c => ({ name: c.name, score: c.score })) });
    fs.writeFileSync(SCORES_FILE, JSON.stringify(history, null, 2));

    const trend = totalScore >= lastScore ? '↑' : '↓';
    const trendClass = totalScore >= lastScore ? 'trend--up' : 'trend--down';

    // Generate HTML Report
    const html = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>BotArena Code Review V2.0</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
            body { font-family: 'Inter', sans-serif; background: #0b141a; color: #e9edef; padding: 40px; margin: 0; line-height: 1.6; }
            .container { max-width: 1100px; margin: 0 auto; }
            h1 { margin: 0; font-size: 1.8rem; font-weight: 800; color: #e9edef; background: none; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
            .branch-badge { background: rgba(0, 168, 132, 0.1); color: #00a884; padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; border: 1px solid rgba(0, 168, 132, 0.3); }
            .score-card { 
                background: rgba(32, 44, 51, 0.7); 
                backdrop-filter: blur(10px);
                padding: 40px; 
                border-radius: 24px; 
                display: flex; 
                align-items: center; 
                gap: 50px; 
                margin-bottom: 40px; 
                border: 1px solid rgba(59, 74, 84, 0.5);
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            }
            .score-value { font-size: 5rem; font-weight: 800; color: #00a884; letter-spacing: -2px; }
            .score-info { flex: 1; }
            .trend { font-size: 1.8rem; margin-left: 15px; vertical-align: middle; }
            .trend--up { color: #00a884; text-shadow: 0 0 10px rgba(0,168,132,0.4); }
            .trend--down { color: #f15c5c; }
            
            .chart-container { display: flex; align-items: flex-end; gap: 12px; height: 160px; margin-top: 20px; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); }
            .chart-group { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end; }
            .chart-bar { width: 100%; background: linear-gradient(180deg, #00d2ff 0%, #3a7bd5 100%); border-radius: 4px; position: relative; transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); min-height: 2px; }
            .chart-bar--high { background: linear-gradient(180deg, #00a884 0%, #00ca9d 100%); }
            .chart-bar--mid { background: linear-gradient(180deg, #ff9800 0%, #ffb74d 100%); }
            .chart-bar--low { background: linear-gradient(180deg, #f15c5c 0%, #ff8a80 100%); }
            
            .chart-bar:hover { filter: brightness(1.2); cursor: help; }
            .chart-bar::after { content: attr(data-score); position: absolute; top: -25px; left: 50%; transform: translateX(-50%); font-size: 0.8rem; font-weight: 800; color: #e9edef; }
            .chart-label { font-size: 0.7rem; font-weight: 600; color: #8696a0; text-transform: uppercase; }

            .category-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 25px; }
            .category-card { 
                background: #202c33; 
                padding: 25px; 
                border-radius: 16px; 
                border-top: 4px solid #3b4a54; 
                transition: transform 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .category-card:hover { transform: translateY(-5px); }
            .category-card--error { border-top-color: #f15c5c; }
            .category-card--ok { border-top-color: #00a884; }
            
            .cat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .cat-name { font-weight: 700; color: #d1d7db; font-size: 1.1rem; }
            .cat-score { font-size: 1.2rem; font-weight: 800; color: #00a884; }
            
            ul { list-style: none; padding: 0; margin: 0; }
            li { padding: 8px 0; color: #aebac1; border-bottom: 1px solid rgba(134, 150, 160, 0.1); font-size: 0.95rem; }
            li:last-child { border: none; }
            .issue-type { font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; margin-right: 8px; font-weight: bold; }
            .type--ERROR { background: rgba(241, 92, 92, 0.1); color: #f15c5c; }
            .type--WARN { background: rgba(255, 152, 0, 0.1); color: #ff9800; }
            
            .verdict { 
                margin-top: 50px; 
                text-align: center; 
                padding: 40px; 
                border-radius: 24px; 
                font-size: 1.8rem; 
                font-weight: 800; 
                background: ${totalScore > 80 ? 'linear-gradient(90deg, #00a884, #00c99d)' : 'linear-gradient(90deg, #ff9800, #ffb74d)'}; 
                color: white; 
                text-transform: uppercase;
                letter-spacing: 2px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🛡️ Code Reviewer V2.0</h1>
                <div style="text-align: right;">
                    <div class="branch-badge">📍 Branch: ${currentBranch}</div>
                    <div style="margin-top: 5px; font-size: 0.8rem; color: #8696a0;">Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</div>
                </div>
            </div>

            <div class="score-card">
                <div class="score-value">${totalScore}<span class="trend ${trendClass}">${trend}</span></div>
                <div class="score-info">
                    <div style="font-size: 1.2rem; color: #8696a0;">Global Quality Score</div>
                    <div class="chart-container">
                        ${categories.map(cat => {
                            let colorClass = 'chart-bar--high';
                            if (cat.score < 80) colorClass = 'chart-bar--mid';
                            if (cat.score < 50) colorClass = 'chart-bar--low';
                            return `
                            <div class="chart-group">
                                <div class="chart-bar ${colorClass}" style="height: ${cat.score}%" data-score="${cat.score}"></div>
                                <div class="chart-label">${cat.id}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>

            <div class="category-grid">
                ${categories.map(c => `
                    <div class="category-card ${c.score === 100 ? 'category-card--ok' : 'category-card--error'}">
                        <div class="cat-header">
                            <span class="cat-name">${c.name}</span>
                            <span class="cat-score">${c.score}/100</span>
                        </div>
                        <ul>
                            ${c.details.length > 0 ? c.details.map(d => `
                                <li><span class="issue-type type--${d.type}">${d.type}</span> ${d.message}</li>
                            `).join('') : '<li>[OK] Nenhuma irregularidade detectada.</li>'}
                        </ul>
                    </div>
                `).join('')}
            </div>

            <div class="verdict">
                VEREDITO C-LEVEL: ${totalScore > 80 ? 'PRONTO PARA ESCALA' : 'REQUER AJUSTES IMEDIATOS'}
            </div>
        </div>
    </body>
    </html>
    `;

    fs.writeFileSync(REPORT_FILE, html);
    // console.log(`[OK] Relatório V2.0 gerado em: ${REPORT_FILE}`);
}

run();
