const { setupBotHandler } = require('../../src/handlers/botHandler');

describe('botHandler Unit Tests', () => {
    let mockClient;
    let mockIo;
    let mockMsg;
    let mockRepos;
    let messageCallback;
    const mockIsClientReady = () => true;

    beforeEach(() => {
        mockClient = {
            removeAllListeners: jest.fn(),
            on: jest.fn((event, cb) => {
                if (event === 'message_create') messageCallback = cb;
            })
        };
        
        mockIo = { emit: jest.fn() };
        
        mockMsg = {
            id: { id: '123', _serialized: 'msg123' },
            from: `551199999${Math.floor(Math.random() * 10000)}@c.us`, // random to avoid seenContacts cache
            to: '5511888888888@c.us',
            body: '',
            fromMe: false,
            timestamp: 1234567890,
            reply: jest.fn().mockResolvedValue(true)
        };
        
        mockRepos = {
            settingsRepo: {
                get: jest.fn().mockResolvedValue({
                    bot_active: true,
                    empresa: 'Test',
                    boas_vindas: 'Olá! Bem-vindo à {{empresa}}!',
                    pix: '123.456.789-00',
                    operation_days: '0,1,2,3,4,5,6',
                    operation_start: '00:00',
                    operation_end: '23:59',
                    mensagem_ausencia: 'No momento estamos fora do horário de atendimento.',
                    menu_lunch_active: true,
                    menu_lunch_start: '00:00',
                    menu_lunch_end: '23:59',
                    menu_acai_active: true,
                    menu_acai_start: '00:00',
                    menu_acai_end: '23:59',
                    menu_events_active: true,
                    menu_events_start: '00:00',
                    menu_events_end: '23:59'
                })
            },
            knowledgeRepo: { findByKeyword: jest.fn().mockResolvedValue(null) },
            menuRepo: { getLatestAsset: jest.fn().mockResolvedValue(null) },
            ragRepo: { searchChunks: jest.fn().mockResolvedValue([]) }
        };
    });

    // ==========================================
    // Caso 1: Mensagem de grupo → bot NÃO responde
    // ==========================================
    test('should NOT reply to group messages (isGroup / @g.us)', async () => {
        mockMsg.from = '120363012345678901@g.us'; // JID de grupo do WhatsApp
        mockMsg.body = 'cardapio';
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        expect(mockMsg.reply).not.toHaveBeenCalled();
        expect(mockRepos.settingsRepo.get).not.toHaveBeenCalled();
    });

    // ==========================================
    // Caso 2: bot_active = false → bot NÃO responde
    // ==========================================
    test('should NOT reply when bot_active is false in settings', async () => {
        mockMsg.body = 'olá, tudo bem?';
        mockMsg.from = 'unique_inactive_test@c.us';
        mockRepos.settingsRepo.get.mockResolvedValue({ bot_active: false });
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        // Bot fetches config but never calls reply
        expect(mockRepos.settingsRepo.get).toHaveBeenCalled();
        expect(mockMsg.reply).not.toHaveBeenCalled();
    });

    // ==========================================
    // Caso 3: Keyword da KB → retorna resposta correspondente
    // ==========================================
    test('should reply with KB response when keyword matches', async () => {
        mockMsg.body = 'horário';
        mockMsg.from = 'unique_kb_test@c.us';
        mockRepos.knowledgeRepo.findByKeyword.mockResolvedValue({
            keyword: 'horário',
            response: 'Funcionamos das 08:00 às 22:00!'
        });
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        expect(mockRepos.knowledgeRepo.findByKeyword).toHaveBeenCalledWith('horário');
        expect(mockMsg.reply).toHaveBeenCalledWith('Funcionamos das 08:00 às 22:00!');
    });

    // ==========================================
    // Caso 4: Sem match na KB → cai no fluxo de boas-vindas
    // ==========================================
    test('should send welcome message when no KB match is found (first contact)', async () => {
        mockMsg.body = 'oi, boa noite!';
        mockMsg.from = 'unique_welcome_test@c.us';
        mockRepos.knowledgeRepo.findByKeyword.mockResolvedValue(null);
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        // First contact → welcome message with empresa interpolated
        expect(mockMsg.reply).toHaveBeenCalledWith('Olá! Bem-vindo à Test!');
        // KB was checked but returned null
        expect(mockRepos.knowledgeRepo.findByKeyword).toHaveBeenCalledWith('oi, boa noite!');
    });

    // ==========================================
    // Caso 5: Mensagem com "pix" → retorna chave pix das settings
    // ==========================================
    test('should reply with PIX key when message contains "pix"', async () => {
        mockMsg.body = 'qual o pix de vocês?';
        mockMsg.from = 'unique_pix_test@c.us';
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        expect(mockMsg.reply).toHaveBeenCalledWith('💰 Nossa chave PIX é: 123.456.789-00');
    });

    // ==========================================
    // Caso 6: RAG match → retorna resposta do chunk semântico
    // ==========================================
    test('should reply with RAG chunk when keyword does not match KB but matches RAG', async () => {
        mockMsg.body = 'quero saber sobre o almoço';
        mockMsg.from = 'unique_rag_test@c.us';
        mockRepos.knowledgeRepo.findByKeyword.mockResolvedValue(null);
        mockRepos.ragRepo.searchChunks.mockResolvedValue([{
            source_type: 'menu_slot',
            source_id: 'lunch',
            content: 'Temos lasanha aos domingos'
        }]);
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        expect(mockRepos.ragRepo.searchChunks).toHaveBeenCalledWith('quero saber sobre o almoço', 3);
        expect(mockMsg.reply).toHaveBeenCalledWith('🍽️ *Encontrei a seguinte informação no Cardápio de Almoço:*\n\nTemos lasanha aos domingos');
    });

    // ==========================================
    // Caso 7: Gatilho cardápio com slot ativo
    // ==========================================
    test('should send text/media for active menus and skip inactive menus', async () => {
        mockMsg.body = 'cardapio';
        mockMsg.from = 'unique_menu_active_test@c.us';
        
        mockRepos.settingsRepo.get.mockResolvedValue({
            bot_active: true,
            operation_days: '0,1,2,3,4,5,6',
            operation_start: '00:00',
            operation_end: '23:59',
            menu_lunch_active: true,
            menu_lunch_start: '00:00',
            menu_lunch_end: '23:59',
            menu_acai_active: false,
            menu_acai_start: '00:00',
            menu_acai_end: '23:59',
            menu_events_active: true,
            menu_events_start: '00:00',
            menu_events_end: '23:59'
        });

        mockRepos.menuRepo.getLatestAsset.mockImplementation((slot) => {
            if (slot === 'lunch') return Promise.resolve({ extracted_text: 'Menu Almoço' });
            if (slot === 'acai') return Promise.resolve({ extracted_text: 'Menu Açaí' });
            if (slot === 'events') return Promise.resolve({ extracted_text: 'Menu Sobremesas' });
            return Promise.resolve(null);
        });

        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);

        expect(mockMsg.reply).toHaveBeenCalledWith('Menu Almoço');
        expect(mockMsg.reply).toHaveBeenCalledWith('Menu Sobremesas');
        expect(mockMsg.reply).not.toHaveBeenCalledWith('Menu Açaí');
    });

    // ==========================================
    // Caso 8: Gatilho cardápio sem nenhum slot ativo
    // ==========================================
    test('should reply with unavailability message when no menu slots are active or in time', async () => {
        mockMsg.body = 'cardapio';
        mockMsg.from = 'unique_menu_unavailable_test@c.us';
        
        mockRepos.settingsRepo.get.mockResolvedValue({
            bot_active: true,
            operation_days: '0,1,2,3,4,5,6',
            operation_start: '00:00',
            operation_end: '23:59',
            menu_lunch_active: false,
            menu_acai_active: false,
            menu_events_active: false
        });

        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);

        expect(mockMsg.reply).toHaveBeenCalledWith('Desculpe, no momento não temos nenhum cardápio disponível para este horário. Tente novamente mais tarde!');
    });

    // ==========================================
    // Caso 9: RAG match com slot inativo/fora do horário
    // ==========================================
    test('should skip RAG match if the menu slot is inactive', async () => {
        mockMsg.body = 'quero saber sobre o açaí';
        mockMsg.from = 'unique_rag_inactive_test@c.us';
        
        mockRepos.settingsRepo.get.mockResolvedValue({
            bot_active: true,
            operation_days: '0,1,2,3,4,5,6',
            operation_start: '00:00',
            operation_end: '23:59',
            menu_acai_active: false,
            menu_acai_start: '00:00',
            menu_acai_end: '23:59'
        });

        mockRepos.ragRepo.searchChunks.mockResolvedValue([
            {
                source_type: 'menu_slot',
                source_id: 'acai',
                content: 'Temos açaí com granola'
            },
            {
                source_type: 'faq',
                source_id: 'faq1',
                content: 'Nosso endereço é Rua Principal'
            }
        ]);

        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);

        expect(mockMsg.reply).not.toHaveBeenCalledWith(expect.stringContaining('Cardápio de Cardápio Arena'));
        expect(mockMsg.reply).toHaveBeenCalledWith('💡 *Encontrei isto na nossa Central de Ajuda:*\n\nNosso endereço é Rua Principal');
    });

    // ==========================================
    // Caso 10: Cruzamento de Meia-Noite
    // ==========================================
    test('should correctly evaluate schedule crossing midnight', async () => {
        mockMsg.body = 'cardapio';
        mockMsg.from = 'unique_midnight_test@c.us';

        const originalDate = global.Date;
        const mockDate = class extends originalDate {
            constructor() {
                super();
            }
            getHours() { return 23; }
            getMinutes() { return 30; }
            getDay() { return 1; }
        };
        global.Date = mockDate;

        try {
            mockRepos.settingsRepo.get.mockResolvedValue({
                bot_active: true,
                operation_days: '0,1,2,3,4,5,6',
                operation_start: '00:00',
                operation_end: '23:59',
                menu_lunch_active: true,
                menu_lunch_start: '10:00',
                menu_lunch_end: '14:00',
                menu_acai_active: true,
                menu_acai_start: '22:00',
                menu_acai_end: '02:00',
                menu_events_active: false
            });

            mockRepos.menuRepo.getLatestAsset.mockImplementation((slot) => {
                if (slot === 'lunch') return Promise.resolve({ extracted_text: 'Menu Almoço' });
                if (slot === 'acai') return Promise.resolve({ extracted_text: 'Menu Açaí' });
                return Promise.resolve(null);
            });

            setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
            await messageCallback(mockMsg);

            expect(mockMsg.reply).toHaveBeenCalledWith('Menu Açaí');
            expect(mockMsg.reply).not.toHaveBeenCalledWith('Menu Almoço');
        } finally {
            global.Date = originalDate;
        }
    });
});
