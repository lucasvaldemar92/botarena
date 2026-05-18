// ==========================================
// 🧪 RAG PIPELINE UNIT TESTS
// ==========================================
// Validates text extraction, semantic chunking, and repository persistence.

const RagRepository = require('../../src/repositories/ragRepository');
const RagService = require('../../src/services/ragService');
const fs = require('fs').promises;

jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn()
    }
}));

describe('RAG Ingestion and Repository Tests', () => {
    let mockDb;
    let ragRepo;
    let ragService;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDb = {
            get: jest.fn(),
            all: jest.fn(),
            run: jest.fn(),
            transaction: jest.fn(async (callback) => await callback())
        };
        // Injection of mockDb with companyId = 1
        ragRepo = new RagRepository(mockDb, 1);
        ragService = new RagService(ragRepo);
    });

    describe('RagRepository Tests', () => {
        test('saveChunks() should run within a transaction, delete old chunks and insert new ones', async () => {
            mockDb.run.mockResolvedValue({ lastID: 10, changes: 1 });

            const chunks = ['Chunk 1 content', 'Chunk 2 content'];
            await ragRepo.saveChunks('menu_slot', 'lunch', chunks);

            // Assert delete call
            expect(mockDb.run).toHaveBeenNthCalledWith(
                1,
                'DELETE FROM rag_chunks WHERE company_id = ? AND source_type = ? AND source_id = ?',
                [1, 'menu_slot', 'lunch']
            );

            // Assert inserts
            expect(mockDb.run).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining('INSERT INTO rag_chunks'),
                [1, 'menu_slot', 'lunch', 0, 'Chunk 1 content']
            );

            expect(mockDb.run).toHaveBeenNthCalledWith(
                3,
                expect.stringContaining('INSERT INTO rag_chunks'),
                [1, 'menu_slot', 'lunch', 1, 'Chunk 2 content']
            );
        });

        test('getChunksBySource() should execute query with ordered indices', async () => {
            mockDb.all.mockResolvedValue([
                { id: 1, chunk_index: 0, content: 'Chunk 1' },
                { id: 2, chunk_index: 1, content: 'Chunk 2' }
            ]);

            const result = await ragRepo.getChunksBySource('menu_slot', 'dinner');

            expect(result).toHaveLength(2);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM rag_chunks WHERE company_id = ? AND source_type = ? AND source_id = ? ORDER BY chunk_index ASC'),
                [1, 'menu_slot', 'dinner']
            );
        });

        test('searchChunks() should run local text search with LIKE parameter', async () => {
            mockDb.all.mockResolvedValue([{ id: 1, content: 'Some matched chunk' }]);

            const results = await ragRepo.searchChunks('matched', 3);

            expect(results).toHaveLength(1);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM rag_chunks WHERE company_id = ? AND content LIKE ? ORDER BY id ASC LIMIT ?'),
                [1, '%matched%', 3]
            );
        });
    });

    describe('RagService Tests', () => {
        test('generateSemanticChunks() should split text cleanly by double line breaks', () => {
            const text = 'Block number 1.\n\nBlock number 2.\n\r\nBlock number 3.';
            const chunks = ragService.generateSemanticChunks(text, 20, 5);

            expect(chunks).toEqual([
                'Block number 1.',
                'Block number 2.',
                'Block number 3.'
            ]);
        });

        test('generateSemanticChunks() should split oversized content with overlap', () => {
            const longText = 'abcdefghijklmnopqrstuvwxyz'; // 26 chars
            // maxChunkSize = 10, overlap = 4
            const chunks = ragService.generateSemanticChunks(longText, 10, 4);

            expect(chunks[0]).toBe('abcdefghij'); // 0 to 10
            // start = 10 - 4 = 6; next is 6 to 16: 'ghijklmnop'
            expect(chunks[1]).toBe('ghijklmnop');
        });

        test('extractTextFromFile() should parse .txt files successfully', async () => {
            fs.readFile.mockResolvedValue('Plain text content');
            
            const text = await ragService.extractTextFromFile('/path/to/menu.txt');
            
            expect(text).toBe('Plain text content');
            expect(fs.readFile).toHaveBeenCalledWith('/path/to/menu.txt', 'utf8');
        });
    });
});
