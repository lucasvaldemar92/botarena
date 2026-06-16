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

    test('get() should return casted boolean for bot_active and menu settings', async () => {
        mockDb.get.mockResolvedValue({ 
            id: 1, 
            bot_active: 1, 
            empresa: 'Test',
            menu_lunch_active: 1,
            menu_lunch_start: '10:00',
            menu_lunch_end: '14:00',
            menu_acai_active: 0,
            menu_acai_start: '14:00',
            menu_acai_end: '22:00',
            menu_events_active: 1,
            menu_events_start: '08:00',
            menu_events_end: '22:00'
        });
        
        const result = await settingsRepo.get();
        
        expect(result.bot_active).toBe(true);
        expect(result.empresa).toBe('Test');
        expect(result.menu_lunch_active).toBe(true);
        expect(result.menu_lunch_start).toBe('10:00');
        expect(result.menu_lunch_end).toBe('14:00');
        expect(result.menu_acai_active).toBe(false);
        expect(result.menu_acai_start).toBe('14:00');
        expect(result.menu_acai_end).toBe('22:00');
        expect(result.menu_events_active).toBe(true);
        expect(result.menu_events_start).toBe('08:00');
        expect(result.menu_events_end).toBe('22:00');
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
            null,       null,       // operation_days
            null,       null,       // operation_start
            null,       null,       // operation_end
            null,       null,       // mensagem_ausencia
            null,       null,       // operation_periods
            null,       null,       // menu_lunch_active
            null,       null,       // menu_lunch_start
            null,       null,       // menu_lunch_end
            null,       null,       // menu_acai_active
            null,       null,       // menu_acai_start
            null,       null,       // menu_acai_end
            null,       null,       // menu_events_active
            null,       null,       // menu_events_start
            null,       null,       // menu_events_end
            null,       null,       // company_name
            null,       null,       // trade_name
            null,       null,       // cnpj
            null,       null,       // base_cep
            null,       null,       // company_street
            null,       null,       // company_number
            null,       null,       // company_neighborhood
            null,       null,       // company_phone
            null,       null,       // company_email
            null,       null,       // latitude
            null,       null,       // longitude
            null,       null,       // consumer_client_id
            null,       null,       // consumer_client_secret
            null,       null,       // consumer_integration_active
            null,       null,       // google_analytics_id
            null,       null,       // google_tag_manager_id
            null,       null,       // google_maps_api_key
            null,       null,       // google_site_verification
            null,       null,       // openai_api_key
            null,       null,       // gemini_api_key
            null,       null,       // openai_active
            null,       null,       // gemini_active
            1                       // company_id
        ]);
    });
});
