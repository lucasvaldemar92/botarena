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
     * Add a new delivery fee entry.
     * @param {Object} data - Delivery fee data object
     * @returns {Promise<Object>} Created entry
     */
    async add(data) {
        return this.create({
            neighborhood: data.neighborhood || 'Desconhecido',
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
        return this.update(id, {
            neighborhood: data.neighborhood || 'Desconhecido',
            zip_code: data.zipCode || data.zip_code || null,
            fee: data.fee !== undefined ? parseFloat(data.fee) : 0.00,
            distance_km: data.distanceKm !== undefined ? parseFloat(data.distanceKm) : (data.distance_km !== undefined ? parseFloat(data.distance_km) : 0.0)
        });
    }

    /**
     * Delete a delivery fee entry by id.
     * @param {number|string} id
     * @returns {Promise<number>} Rows deleted
     */
    async remove(id) {
        return this.delete(id);
    }
}

module.exports = DeliveryFeeRepository;
