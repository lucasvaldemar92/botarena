// ==========================================
// 🛵 DELIVERY FEE REPOSITORY
// ==========================================
// Encapsulates all SQL for the `delivery_fees` table.

const BaseRepository = require('./BaseRepository');

class DeliveryFeeRepository extends BaseRepository {
    constructor(db, companyId) {
        super(db, 'delivery_fees', companyId);
    }

    /**
     * Get all delivery fees for this tenant, ordered by neighborhood.
     * @returns {Promise<Array>}
     */
    async getAll() {
        return this.findAll('id DESC');
    }

    /**
     * Find a delivery fee entry by zip_code.
     * @param {string} zipCode
     * @returns {Promise<Object|null>}
     */
    async findByZipCode(zipCode) {
        return this.db.get(
            'SELECT * FROM delivery_fees WHERE company_id = ? AND zip_code = ?',
            [this.companyId, zipCode]
        );
    }

    /**
     * Find a delivery fee entry by exact combination of zip_code, neighborhood and address (street).
     * @param {string} zipCode
     * @param {string} neighborhood
     * @param {string} address
     * @returns {Promise<Object|null>}
     */
    async findDuplicate(zipCode, neighborhood, address) {
        return this.db.get(
            'SELECT * FROM delivery_fees WHERE company_id = ? AND zip_code = ? AND neighborhood = ? AND address = ?',
            [this.companyId, zipCode, neighborhood, address]
        );
    }

    /**
     * Add a new delivery fee entry.
     * @param {Object} data - Delivery fee data object
     * @returns {Promise<Object>} Created entry
     */
    async add(data) {
        return this.create({
            neighborhood: data.neighborhood || 'Desconhecido',
            address: data.address || null,
            zip_code: data.zipCode || data.zip_code || null,
            fee: data.fee !== undefined ? parseFloat(data.fee) : 0.00,
            distance_km: data.distanceKm !== undefined ? parseFloat(data.distanceKm) : (data.distance_km !== undefined ? parseFloat(data.distance_km) : 0.0)
        });
    }

    /**
     * Update an existing delivery fee entry.
     * @param {number} id
     * @param {Object} data
     * @returns {Promise<number>} rows changed
     */
    async edit(id, data) {
        const updateData = {};
        if (data.neighborhood !== undefined) updateData.neighborhood = data.neighborhood;
        if (data.address !== undefined) updateData.address = data.address;
        if (data.zipCode !== undefined || data.zip_code !== undefined) {
            updateData.zip_code = data.zipCode || data.zip_code;
        }
        if (data.fee !== undefined) updateData.fee = parseFloat(data.fee);
        if (data.distanceKm !== undefined || data.distance_km !== undefined) {
            updateData.distance_km = data.distanceKm !== undefined ? parseFloat(data.distanceKm) : parseFloat(data.distance_km);
        }
        return this.update(id, updateData);
    }

    /**
     * Delete a delivery fee entry by id.
     * @param {number|string} id
     * @returns {Promise<number>} Rows deleted
     */
    async remove(id) {
        return this.delete(id);
    }

    /**
     * Recalculate all delivery fees for this company based on active KM ranges.
     * @param {Object} deliveryRangeRepo - Repository of delivery ranges
     * @returns {Promise<void>}
     */
    async recalculateAllFees(deliveryRangeRepo) {
        const fees = await this.getAll();
        for (const feeItem of fees) {
            const distance = feeItem.distance_km || 0;
            if (distance > 0) {
                const range = await deliveryRangeRepo.findActiveRangeByDistance(distance);
                if (range) {
                    if (feeItem.fee !== range.fee) {
                        await this.edit(feeItem.id, { fee: range.fee });
                    }
                }
            }
        }
    }
}

module.exports = DeliveryFeeRepository;
