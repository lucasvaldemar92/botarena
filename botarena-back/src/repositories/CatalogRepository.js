const BaseRepository = require('./BaseRepository');

class CatalogRepository extends BaseRepository {
    constructor(db, companyId = 1) {
        super(db, 'catalog_items', companyId);
    }

    async findAll(orderBy = 'categoria ASC, c.nome ASC') {
        const sql = `
            SELECT c.*, COALESCE(cat.nome, c.categoria, 'Geral') AS categoria 
            FROM catalog_items c 
            LEFT JOIN catalog_categories cat ON c.categoria_id = cat.id
            WHERE c.company_id = ? 
            ORDER BY ${orderBy}
        `;
        return await this.db.all(sql, [this.companyId]);
    }

    async findByCategory(categoria) {
        const sql = `
            SELECT c.*, COALESCE(cat.nome, c.categoria, 'Geral') AS categoria 
            FROM catalog_items c 
            LEFT JOIN catalog_categories cat ON c.categoria_id = cat.id
            WHERE c.company_id = ? 
              AND (cat.nome = ? OR (c.categoria = ? AND c.categoria_id IS NULL))
              AND c.is_adicional = 0 
            ORDER BY c.nome ASC
        `;
        return await this.db.all(sql, [this.companyId, categoria, categoria]);
    }

    async findAdicionais() {
        const sql = `
            SELECT c.*, COALESCE(cat.nome, c.categoria, 'Geral') AS categoria 
            FROM catalog_items c 
            LEFT JOIN catalog_categories cat ON c.categoria_id = cat.id
            WHERE c.company_id = ? AND c.is_adicional = 1 
            ORDER BY c.nome ASC
        `;
        return await this.db.all(sql, [this.companyId]);
    }

    async findById(id) {
        const sql = `
            SELECT c.*, COALESCE(cat.nome, c.categoria, 'Geral') AS categoria 
            FROM catalog_items c 
            LEFT JOIN catalog_categories cat ON c.categoria_id = cat.id
            WHERE c.company_id = ? AND c.id = ?
        `;
        return await this.db.get(sql, [this.companyId, id]);
    }

    async findByPdv(cod_pdv) {
        const sql = `
            SELECT c.*, COALESCE(cat.nome, c.categoria, 'Geral') AS categoria 
            FROM catalog_items c 
            LEFT JOIN catalog_categories cat ON c.categoria_id = cat.id
            WHERE c.company_id = ? AND c.cod_pdv = ?
        `;
        return await this.db.get(sql, [this.companyId, cod_pdv]);
    }

    async create(data) {
        const sql = `
            INSERT INTO catalog_items (company_id, cod_pdv, nome, descricao, preco, categoria, categoria_id, is_adicional, disponivel)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await this.db.run(sql, [
            this.companyId,
            data.cod_pdv || null,
            data.nome,
            data.descricao || null,
            data.preco || 0,
            data.categoria,
            data.categoria_id || null,
            data.is_adicional ? 1 : 0,
            data.disponivel !== undefined ? (data.disponivel ? 1 : 0) : 1
        ]);
        return { id: result.lastID, ...data };
    }

    async update(id, data) {
        const sql = `
            UPDATE catalog_items
            SET cod_pdv = ?, nome = ?, descricao = ?, preco = ?, categoria = ?, categoria_id = ?, is_adicional = ?, disponivel = ?
            WHERE company_id = ? AND id = ?
        `;
        await this.db.run(sql, [
            data.cod_pdv || null,
            data.nome,
            data.descricao || null,
            data.preco || 0,
            data.categoria,
            data.categoria_id || null,
            data.is_adicional ? 1 : 0,
            data.disponivel ? 1 : 0,
            this.companyId,
            id
        ]);
        return this.findById(id);
    }

    async delete(id) {
        const sql = `DELETE FROM catalog_items WHERE company_id = ? AND id = ?`;
        const result = await this.db.run(sql, [this.companyId, id]);
        return result.changes > 0;
    }

    async toggleDisponivel(id) {
        const item = await this.findById(id);
        if (!item) throw new Error('Item não encontrado');
        
        const novoStatus = item.disponivel === 1 ? 0 : 1;
        const sql = `UPDATE catalog_items SET disponivel = ? WHERE company_id = ? AND id = ?`;
        await this.db.run(sql, [novoStatus, this.companyId, id]);
        return { id, disponivel: novoStatus };
    }

    // ==========================================
    // 📁 CATEGORIES MANAGEMENT METHODS
    // ==========================================

    async findAllCategories(orderBy = 'nome ASC') {
        const sql = `SELECT * FROM catalog_categories WHERE company_id = ? ORDER BY ${orderBy}`;
        return await this.db.all(sql, [this.companyId]);
    }

    async findCategoryByName(nome) {
        const sql = `SELECT * FROM catalog_categories WHERE company_id = ? AND nome = ? COLLATE NOCASE`;
        return await this.db.get(sql, [this.companyId, nome]);
    }

    async findCategoryById(id) {
        const sql = `SELECT * FROM catalog_categories WHERE company_id = ? AND id = ?`;
        return await this.db.get(sql, [this.companyId, id]);
    }

    async createCategory(nome) {
        const sql = `INSERT INTO catalog_categories (company_id, nome) VALUES (?, ?)`;
        const result = await this.db.run(sql, [this.companyId, nome]);
        return { id: result.lastID, company_id: this.companyId, nome };
    }

    async updateCategory(id, nome) {
        const sql = `UPDATE catalog_categories SET nome = ? WHERE company_id = ? AND id = ?`;
        await this.db.run(sql, [nome, this.companyId, id]);
        return { id, company_id: this.companyId, nome };
    }

    async deleteCategory(id) {
        // Verifica se há produtos ou adicionais vinculados a esta categoria
        const checkSql = `SELECT COUNT(*) as count FROM catalog_items WHERE company_id = ? AND categoria_id = ?`;
        const row = await this.db.get(checkSql, [this.companyId, id]);
        if (row && row.count > 0) {
            throw new Error("Não é possível excluir a categoria pois existem produtos vinculados a ela.");
        }

        const sqlDelete = `DELETE FROM catalog_categories WHERE company_id = ? AND id = ?`;
        const result = await this.db.run(sqlDelete, [this.companyId, id]);
        return result.changes > 0;
    }
}

module.exports = CatalogRepository;
