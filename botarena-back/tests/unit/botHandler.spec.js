const { setupBotHandler } = require('../../src/handlers/botHandler');

describe('botHandler Unit Tests', () => {
    let mockClient;
    let mockIo;
    let mockMsg;
    let mockRepos;
    let messageCallback;
    const mockIsClientReady = () => true;

    beforeEach(() => {
        // Reset the seenContacts set indirectly by using new contact IDs or just let it be.
        // For pure isolation, we'd mock the set, but different from IDs work well.
        
        mockClient = {
            removeAllListeners: jest.fn(),
            on: jest.fn((event, cb) => {
                if (event === 'message_create') messageCallback = cb;
            })
        };
        
        mockIo = { emit: jest.fn() };
        
        mockMsg = {
            id: { id: '123', _serialized: 'msg123' },
            from: `551199999${Math.floor(Math.random() * 1000)}@c.us`, // random to avoid seenContacts cache
            to: '5511888888888@c.us',
            body: '',
            fromMe: false,
            timestamp: 1234567890,
            reply: jest.fn().mockResolvedValue(true)
        };
        
        mockRepos = {
            settingsRepo: { get: jest.fn().mockResolvedValue({ bot_active: true, empresa: 'Test', boas_vindas: 'Ola {{empresa}}' }) },
            knowledgeRepo: { findByKeyword: jest.fn().mockResolvedValue(null) },
            menuRepo: { getActive: jest.fn().mockResolvedValue(null) }
        };
    });

    test('should reply with menu when keyword is "cardapio"', async () => {
        mockMsg.body = 'cardapio';
        mockMsg.from = 'unique_cardapio_test@c.us';
        mockRepos.menuRepo.getActive.mockResolvedValue({ extracted_text: 'Aqui está o cardápio' });
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        // It will reply with greeting first, then the menu
        expect(mockMsg.reply).toHaveBeenCalledWith('Aqui está o cardápio');
    });

    test('should reply with PIX when keyword is "pix"', async () => {
        mockMsg.body = 'qual o seu pix?';
        mockMsg.from = 'unique_pix_test@c.us';
        mockRepos.settingsRepo.get.mockResolvedValue({ bot_active: true, pix: '123456789' });
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        expect(mockMsg.reply).toHaveBeenCalledWith('💰 Nossa chave PIX é: 123456789');
    });

    test('should reply with KB response when keyword matches', async () => {
        mockMsg.body = 'horario de funcionamento';
        mockMsg.from = 'unique_kb_test@c.us';
        mockRepos.knowledgeRepo.findByKeyword.mockResolvedValue({ keyword: 'horario', response: 'Aberto das 18h as 23h' });
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        expect(mockMsg.reply).toHaveBeenCalledWith('Aberto das 18h as 23h');
    });

    test('should ignore messages from status@broadcast', async () => {
        mockMsg.from = 'status@broadcast';
        mockMsg.body = 'cardapio';
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        expect(mockMsg.reply).not.toHaveBeenCalled();
    });

    test('should ignore messages when bot_active is false', async () => {
        mockMsg.body = 'cardapio';
        mockMsg.from = 'unique_inactive_test@c.us';
        mockRepos.settingsRepo.get.mockResolvedValue({ bot_active: false });
        
        setupBotHandler(mockClient, mockIo, mockIsClientReady, mockRepos);
        await messageCallback(mockMsg);
        
        expect(mockMsg.reply).not.toHaveBeenCalled();
    });
});
