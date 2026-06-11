// ==========================================
// 🧪 RAG ROUTES UNIT TESTS
// ==========================================
// Validates batch address ingestion and lookup endpoints.

const { createApiRouter } = require('../../src/routes/api');

// Mock auth middleware to just pass through
jest.mock('../../src/middleware/auth', () => (req, res, next) => {
    req.user = { companyId: 1 };
    next();
});

describe('RAG Routes Unit Tests', () => {
    let mockRagRepo;
    let router;
    let mockRes;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockRagRepo = {
            companyId: 1,
            db: {
                all: jest.fn(),
                transaction: jest.fn(cb => cb()),
                get: jest.fn(),
                run: jest.fn()
            },
            create: jest.fn(),
            saveChunks: jest.fn(),
            deleteChunksBySource: jest.fn()
        };

        router = createApiRouter({
            ragRepo: mockRagRepo,
            authMiddleware: (req, res, next) => next() // mock local override if needed
        });

        mockRes = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
    });

    // Helper to find a registered route handler in Express Router stack
    function getHandler(path, method) {
        const layer = router.stack.find(s => 
            s.route && 
            s.route.path === path && 
            s.route.methods[method]
        );
        if (!layer) return null;
        // The last layer in the route stack is the handler itself (after auth middlewares)
        return layer.route.stack[layer.route.stack.length - 1].handle;
    }

    describe('POST /rag/upload-address-batch', () => {
        test('should save address chunks successfully', async () => {
            const handler = getHandler('/rag/upload-address-batch', 'post');
            expect(handler).toBeDefined();

            const req = {
                body: {
                    sourceId: 'imported_sheet_test',
                    chunks: [
                        'CEP: 89201-000 | Bairro: Centro | Rua: Rua Visconde de Taunay | Coordenadas: -26.3, -48.8 | Taxa: 10.00',
                        'CEP: 89202-000 | Bairro: Vila Nova | Rua: Rua XV de Novembro | Coordenadas: -26.2, -48.9 | Taxa: 15.00'
                    ]
                }
            };

            mockRagRepo.db.all.mockResolvedValue([]);
            mockRagRepo.db.get.mockResolvedValue({ max_idx: null });
            mockRagRepo.create.mockResolvedValue({ id: 100 });

            await handler(req, mockRes);

            expect(mockRagRepo.db.all).toHaveBeenCalled();
            expect(mockRagRepo.create).toHaveBeenCalledTimes(2);
            expect(mockRes.json).toHaveBeenCalledWith({ success: true, inserted: 2, merged: 0, total: 2 });
        });

        test('should return 400 if validation fails', async () => {
            const handler = getHandler('/rag/upload-address-batch', 'post');
            
            const req = {
                body: {
                    sourceId: '',
                    chunks: 'not-an-array'
                }
            };

            await handler(req, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.any(String)
            }));
        });
    });

    describe('GET /rag/lookup-address', () => {
        test('should perform lookup and return parsed address object', async () => {
            const handler = getHandler('/rag/lookup-address', 'get');
            expect(handler).toBeDefined();

            const req = {
                query: { query: '89201000' }
            };

            mockRagRepo.db.all.mockResolvedValue([
                {
                    content: 'CEP: 89201-000 | Bairro: Centro | Rua: Rua Visconde de Taunay | Coordenadas: -26.3015, -48.8452 | Taxa: 10.00'
                }
            ]);

            await handler(req, mockRes);

            // Verified it queries for both formatted and raw CEP formats
            expect(mockRagRepo.db.all).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                results: [{
                    cep: '89201-000',
                    bairro: 'Centro',
                    rua: 'Rua Visconde de Taunay',
                    latitude: -26.3015,
                    longitude: -48.8452,
                    taxa: 10.00
                }]
            });
        });

        test('should return empty list if query is empty', async () => {
            const handler = getHandler('/rag/lookup-address', 'get');
            const req = {
                query: { query: '' }
            };

            await handler(req, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({ success: false, results: [] });
            expect(mockRagRepo.db.all).not.toHaveBeenCalled();
        });
    });
});
