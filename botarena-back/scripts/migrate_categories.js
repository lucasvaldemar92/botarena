// ==========================================
// 🔄 MIGRATION SCRIPT: Catalog Categories
// ==========================================
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('--- Iniciando Migração: Categorias do Catálogo ---');

let dbPath;
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.startsWith('sqlite://')) {
    const cleanPath = dbUrl.replace('sqlite://', '').replace('./', '');
    dbPath = path.resolve(__dirname, '..', cleanPath);
} else {
    dbPath = path.join(__dirname, '../database/botarena.db');
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ [Migration] Cannot open database:', err.message);
        process.exit(1);
    }
});

// Helper: check if column exists
function checkColumn(table, column) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table})`, (err, rows) => {
            if (err) return reject(err);
            resolve(rows.some(r => r.name === column));
        });
    });
}

// Helper: run SQL statement
function runSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// Helper: get single row
function getRow(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

// Helper: get all rows
function allRows(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

async function startMigration() {
    try {
        // 1. Executa o SQL de criação da tabela catalog_categories
        const sqlPath = path.join(__dirname, '../migrations/009_create_catalog_categories.sql');
        const sqlSchema = fs.readFileSync(sqlPath, 'utf8');
        
        await new Promise((resolve, reject) => {
            db.exec(sqlSchema, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
        console.log('✅ Tabela "catalog_categories" criada ou verificada.');

        // 2. Adiciona a coluna categoria_id na tabela catalog_items se não existir
        const hasCol = await checkColumn('catalog_items', 'categoria_id');
        if (!hasCol) {
            await runSQL('ALTER TABLE catalog_items ADD COLUMN categoria_id INTEGER');
            console.log('✅ Coluna "categoria_id" adicionada em "catalog_items".');
        } else {
            console.log('⏭️ Coluna "categoria_id" já existe em "catalog_items".');
        }

        // 3. Garante que a categoria padrão "Geral" exista na tabela catalog_categories
        let geralCategory = await getRow('SELECT * FROM catalog_categories WHERE nome = ?', ['Geral']);
        if (!geralCategory) {
            await runSQL('INSERT INTO catalog_categories (nome) VALUES (?)', ['Geral']);
            geralCategory = await getRow('SELECT * FROM catalog_categories WHERE nome = ?', ['Geral']);
            console.log('✅ Categoria padrão "Geral" cadastrada.');
        }

        // 4. Migração de dados legados: Mapeia categorias do tipo string para IDs reais
        const legacyItems = await allRows('SELECT id, categoria, categoria_id FROM catalog_items');
        let migratedCount = 0;

        for (const item of legacyItems) {
            let catName = item.categoria ? String(item.categoria).trim() : '';
            if (!catName) catName = 'Geral';

            // Busca se essa categoria de texto já existe na tabela catalog_categories
            let catRow = await getRow('SELECT * FROM catalog_categories WHERE nome = ? COLLATE NOCASE', [catName]);
            if (!catRow) {
                // Se não existir, cadastra no banco
                await runSQL('INSERT INTO catalog_categories (nome) VALUES (?)', [catName]);
                catRow = await getRow('SELECT * FROM catalog_categories WHERE nome = ? COLLATE NOCASE', [catName]);
                console.log(`✅ Categoria "${catName}" cadastrada durante migração de itens.`);
            }

            // Se o item não tiver categoria_id, atualiza com a referência correta
            if (item.categoria_id === null || item.categoria_id === undefined) {
                await runSQL('UPDATE catalog_items SET categoria_id = ? WHERE id = ?', [catRow.id, item.id]);
                migratedCount++;
            }
        }

        if (migratedCount > 0) {
            console.log(`✅ ${migratedCount} item(ns) de catálogo associados aos novos IDs de categoria.`);
        } else {
            console.log('⏭️ Nenhum item precisou de associação de categoria legada.');
        }

        console.log('🎉 Migração concluída com sucesso!');
        db.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro na migração de categorias:', err);
        db.close();
        process.exit(1);
    }
}

startMigration();
