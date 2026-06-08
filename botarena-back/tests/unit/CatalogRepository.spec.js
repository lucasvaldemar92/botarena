const CatalogRepository = require('../../src/repositories/CatalogRepository');

describe('CatalogRepository Unit Tests - Categories', () => {
    let mockDb;
    let catalogRepo;

    beforeEach(() => {
        mockDb = {
            get: jest.fn(),
            all: jest.fn(),
            run: jest.fn(),
        };
        catalogRepo = new CatalogRepository(mockDb, 1);
    });

    test('updateCategory() should run UPDATE query and return updated category object', async () => {
        mockDb.run.mockResolvedValue({ changes: 1 });
        
        const result = await catalogRepo.updateCategory(5, 'Novas Pizzas');
        
        expect(result).toEqual({ id: 5, company_id: 1, nome: 'Novas Pizzas' });
        expect(mockDb.run).toHaveBeenCalledWith(
            'UPDATE catalog_categories SET nome = ? WHERE company_id = ? AND id = ?',
            ['Novas Pizzas', 1, 5]
        );
    });

    test('deleteCategory() should delete catalog_categories if no items are linked', async () => {
        mockDb.get.mockResolvedValue({ count: 0 });
        mockDb.run.mockResolvedValue({ changes: 1 });
        
        const result = await catalogRepo.deleteCategory(10);
        
        expect(result).toBe(true);
        expect(mockDb.get).toHaveBeenCalledWith(
            'SELECT COUNT(*) as count FROM catalog_items WHERE company_id = ? AND categoria_id = ?',
            [1, 10]
        );
        expect(mockDb.run).toHaveBeenCalledWith(
            'DELETE FROM catalog_categories WHERE company_id = ? AND id = ?',
            [1, 10]
        );
    });

    test('deleteCategory() should throw error and not delete if items are linked', async () => {
        mockDb.get.mockResolvedValue({ count: 3 });
        
        await expect(catalogRepo.deleteCategory(10)).rejects.toThrow(
            'Não é possível excluir a categoria pois existem produtos vinculados a ela.'
        );
        expect(mockDb.run).not.toHaveBeenCalled();
    });
});
