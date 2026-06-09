const DeliveryFeeRepository = require('../../src/repositories/DeliveryFeeRepository');

describe('DeliveryFeeRepository Unit Tests', () => {
    let mockDb;
    let deliveryFeeRepo;

    beforeEach(() => {
        mockDb = {
            get: jest.fn(),
            all: jest.fn(),
            run: jest.fn(),
        };
        deliveryFeeRepo = new DeliveryFeeRepository(mockDb, 1);
    });

    test('getAll() should query database with findAll ordering', async () => {
        mockDb.all.mockResolvedValue([
            { id: 2, neighborhood: 'Jardim América', zip_code: '15084-120', fee: 7.50 },
            { id: 1, neighborhood: 'Centro', zip_code: '87055-520', fee: 5.00 }
        ]);

        const result = await deliveryFeeRepo.getAll();
        
        expect(result).toHaveLength(2);
        expect(mockDb.all).toHaveBeenCalledWith(
            'SELECT * FROM delivery_fees WHERE company_id = ? ORDER BY id DESC',
            [1]
        );
    });

    test('findByZipCode() should query by company_id and zip_code', async () => {
        mockDb.get.mockResolvedValue({ id: 1, neighborhood: 'Centro', zip_code: '87055-520', fee: 5.00 });

        const result = await deliveryFeeRepo.findByZipCode('87055-520');

        expect(result.neighborhood).toBe('Centro');
        expect(mockDb.get).toHaveBeenCalledWith(
            'SELECT * FROM delivery_fees WHERE company_id = ? AND zip_code = ?',
            [1, '87055-520']
        );
    });

    test('add() should insert record with company_id, correct parsed fee and distance_km', async () => {
        mockDb.run.mockResolvedValue({ lastID: 3 });

        const result = await deliveryFeeRepo.add({
            neighborhood: 'Vila Nova',
            zipCode: '12345-000',
            fee: '10.50',
            distanceKm: 4.5
        });

        expect(result.id).toBe(3);
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO delivery_fees'),
            [1, 'Vila Nova', '12345-000', 10.50, 4.5]
        );
    });

    test('add() should default distance_km to 0.0 if not provided', async () => {
        mockDb.run.mockResolvedValue({ lastID: 3 });

        const result = await deliveryFeeRepo.add({
            neighborhood: 'Vila Nova',
            zipCode: '12345-000',
            fee: '10.50'
        });

        expect(result.id).toBe(3);
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO delivery_fees'),
            [1, 'Vila Nova', '12345-000', 10.50, 0.0]
        );
    });

    test('edit() should update record correctly including distance_km', async () => {
        mockDb.run.mockResolvedValue({ changes: 1 });

        const changes = await deliveryFeeRepo.edit(3, {
            neighborhood: 'Vila Nova Alterada',
            zipCode: '12345-000',
            fee: 15.00,
            distanceKm: 5.2
        });

        expect(changes).toBe(1);
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE delivery_fees SET'),
            ['Vila Nova Alterada', '12345-000', 15.00, 5.2, 1, 3]
        );
    });

    test('edit() should update record with default distance_km if not provided', async () => {
        mockDb.run.mockResolvedValue({ changes: 1 });

        const changes = await deliveryFeeRepo.edit(3, {
            neighborhood: 'Vila Nova Alterada',
            zipCode: '12345-000',
            fee: 15.00
        });

        expect(changes).toBe(1);
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE delivery_fees SET'),
            ['Vila Nova Alterada', '12345-000', 15.00, 0.0, 1, 3]
        );
    });

    test('remove() should delete by id', async () => {
        mockDb.run.mockResolvedValue({ changes: 1 });

        const deleted = await deliveryFeeRepo.remove(3);

        expect(deleted).toBe(1);
        expect(mockDb.run).toHaveBeenCalledWith(
            'DELETE FROM delivery_fees WHERE company_id = ? AND id = ?',
            [1, 3]
        );
    });
});
