const SettingsRepository = require('../../src/repositories/SettingsRepository');

describe('SettingsRepository Unit Tests', () => {
    let mockDb;
    let settingsRepo;

    beforeEach(() => {
        mockDb = {
            get: jest.fn(),
            all: jest.fn(),
            run: jest.fn(),
        };
        // Use companyId = 1 for tests
        settingsRepo = new SettingsRepository(mockDb, 1);
    });

    test('get() should return casted boolean for bot_active', async () => {
        mockDb.get.mockResolvedValue({ id: 1, bot_active: 1, empresa: 'Test' });
        
        const result = await settingsRepo.get();
        
        expect(result.bot_active).toBe(true);
        expect(result.empresa).toBe('Test');
        expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM settings WHERE company_id = ?', [1]);
    });

    test('update() should correctly build UPDATE query with COALESCE', async () => {
        mockDb.run.mockResolvedValue({ changes: 1 });
        
        const changes = await settingsRepo.update({ empresa: 'New Name', bot_active: false });
        
        expect(changes).toBe(1);
        expect(mockDb.run).toHaveBeenCalled();
        const callArgs = mockDb.run.mock.calls[0];
        expect(callArgs[0]).toContain('UPDATE settings SET');
        expect(callArgs[1]).toEqual([
            'New Name', 'New Name', // empresa
            null,       null,       // pix
            null,       null,       // nome_favorecido
            null,       null,       // cardapio_url
            null,       null,       // boas_vindas
            0,          0,          // bot_active
            1                       // company_id
        ]);
    });
});
