// ==========================================
// 📏 DELIVERY RANGE REPOSITORY
// ==========================================
// Encapsulates all SQL for the `delivery_ranges` table.
// Each range defines a KM interval (min_km → max_km) with a fee and active status.

const BaseRepository = require('./BaseRepository');

class DeliveryRangeRepository extends BaseRepository {
    constructor(db, companyId) {
        super(db, 'delivery_ranges', companyId);
    }

    /**
     * Get all delivery ranges for this tenant, ordered by min_km ascending.
     * @returns {Promise<Array>}
     */
    async getAll() {
        return this.db.all(
            'SELECT * FROM delivery_ranges WHERE company_id = ? ORDER BY min_km ASC',
            [this.companyId]
        );
    }

    /**
     * Get only active delivery ranges.
     * @returns {Promise<Array>}
     */
    async getActiveRanges() {
        return this.db.all(
            'SELECT * FROM delivery_ranges WHERE company_id = ? AND is_active = 1 ORDER BY min_km ASC',
            [this.companyId]
        );
    }

    /**
     * Find the active range that contains a given distance.
     * @param {number} distanceKm - The distance to check
     * @returns {Promise<Object|null>} The matching range or null
     */
    async findRangeByDistance(distanceKm) {
        return this.db.get(
            'SELECT * FROM delivery_ranges WHERE company_id = ? AND min_km <= ? AND max_km >= ? ORDER BY min_km ASC LIMIT 1',
            [this.companyId, distanceKm, distanceKm]
        );
    }

    /**
     * Find the active range that contains a given distance (only active ranges).
     * @param {number} distanceKm - The distance to check
     * @returns {Promise<Object|null>} The matching active range or null
     */
    async findActiveRangeByDistance(distanceKm) {
        return this.db.get(
            'SELECT * FROM delivery_ranges WHERE company_id = ? AND is_active = 1 AND min_km <= ? AND max_km >= ? ORDER BY min_km ASC LIMIT 1',
            [this.companyId, distanceKm, distanceKm]
        );
    }

    /**
     * Check if a new range (min_km → max_km) overlaps with any existing range.
     * @param {number} minKm
     * @param {number} maxKm
     * @param {number|null} excludeId - ID to exclude (for updates)
     * @returns {Promise<Object|null>} The overlapping range or null
     */
    async findOverlap(minKm, maxKm, excludeId = null) {
        let sql = 'SELECT * FROM delivery_ranges WHERE company_id = ? AND min_km < ? AND max_km > ?';
        const params = [this.companyId, maxKm, minKm];

        if (excludeId) {
            sql += ' AND id != ?';
            params.push(excludeId);
        }

        sql += ' LIMIT 1';
        return this.db.get(sql, params);
    }

    /**
     * Add a new delivery range entry.
     * @param {Object} data - Range data { minKm, maxKm, fee, isActive }
     * @returns {Promise<Object>} Created entry
     */
    async add(data) {
        return this.create({
            min_km: parseFloat(data.minKm || data.min_km || 0),
            max_km: parseFloat(data.maxKm || data.max_km || 0),
            fee: data.fee !== undefined ? parseFloat(data.fee) : 0.00,
            is_active: data.isActive !== undefined ? (data.isActive ? 1 : 0) : (data.is_active !== undefined ? data.is_active : 1)
        });
    }

    /**
     * Update an existing delivery range.
     * @param {number} id
     * @param {Object} data
     * @returns {Promise<number>} rows changed
     */
    async edit(id, data) {
        const updateData = {};
        if (data.minKm !== undefined || data.min_km !== undefined) {
            updateData.min_km = parseFloat(data.minKm !== undefined ? data.minKm : data.min_km);
        }
        if (data.maxKm !== undefined || data.max_km !== undefined) {
            updateData.max_km = parseFloat(data.maxKm !== undefined ? data.maxKm : data.max_km);
        }
        if (data.fee !== undefined) {
            updateData.fee = parseFloat(data.fee);
        }
        if (data.isActive !== undefined) {
            updateData.is_active = data.isActive ? 1 : 0;
        } else if (data.is_active !== undefined) {
            updateData.is_active = data.is_active;
        }
        updateData.updated_at = new Date().toISOString();
        return this.update(id, updateData);
    }

    /**
     * Toggle the active status of a range.
     * @param {number} id
     * @param {boolean} isActive
     * @returns {Promise<number>} rows changed
     */
    async toggleActive(id, isActive) {
        return this.update(id, {
            is_active: isActive ? 1 : 0,
            updated_at: new Date().toISOString()
        });
    }

    /**
     * Delete a delivery range by id.
     * @param {number|string} id
     * @returns {Promise<number>} Rows deleted
     */
    async remove(id) {
        return this.delete(id);
    }
}

module.exports = DeliveryRangeRepository;
