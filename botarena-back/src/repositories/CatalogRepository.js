const BaseRepository = require('./BaseRepository');

class CatalogRepository extends BaseRepository {
    constructor(db, companyId = 1) {
        super(db, 'catalog_items', companyId);
    }

    async findAll(orderBy = 'categoria ASC, nome ASC') {
        const sql = `SELECT * FROM catalog_items WHERE company_id = ? ORDER BY ${orderBy}`;
        return await this.db.all(sql, [this.companyId]);
    }

    async findByCategory(categoria) {
        const sql = `SELECT * FROM catalog_items WHERE company_id = ? AND categoria = ? AND is_adicional = 0 ORDER BY nome ASC`;
        return await this.db.all(sql, [this.companyId, categoria]);
    }

    async findAdicionais() {
        const sql = `SELECT * FROM catalog_items WHERE company_id = ? AND is_adicional = 1 ORDER BY nome ASC`;
        return await this.db.all(sql, [this.companyId]);
    }

    async findById(id) {
        const sql = `SELECT * FROM catalog_items WHERE company_id = ? AND id = ?`;
        return await this.db.get(sql, [this.companyId, id]);
    }

    async create(data) {
        const sql = `
            INSERT INTO catalog_items (company_id, cod_pdv, nome, descricao, preco, categoria, is_adicional, disponivel)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await this.db.run(sql, [
            this.companyId,
            data.cod_pdv || null,
            data.nome,
            data.descricao || null,
            data.preco || 0,
            data.categoria,
            data.is_adicional ? 1 : 0,
            data.disponivel !== undefined ? (data.disponivel ? 1 : 0) : 1
        ]);
        return { id: result.lastID, ...data };
    }

    async update(id, data) {
        const sql = `
            UPDATE catalog_items
            SET cod_pdv = ?, nome = ?, descricao = ?, preco = ?, categoria = ?, is_adicional = ?, disponivel = ?
            WHERE company_id = ? AND id = ?
        `;
        await this.db.run(sql, [
            data.cod_pdv || null,
            data.nome,
            data.descricao || null,
            data.preco || 0,
            data.categoria,
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
}

module.exports = CatalogRepository;
