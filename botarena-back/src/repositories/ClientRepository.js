// ==========================================
// 👤 CLIENT REPOSITORY
// ==========================================
// Encapsulates all SQL for the `clients` table.

const BaseRepository = require('./BaseRepository');

class ClientRepository extends BaseRepository {
    constructor(db, companyId) {
        super(db, 'clients', companyId);
    }

    /**
     * Get all clients for this tenant, newest first.
     * @returns {Promise<Array>}
     */
    async getAll() {
        return this.findAll('id DESC');
    }

    /**
     * Add a new client entry.
     * @param {Object} data - Client data object
     * @returns {Promise<Object>} Created entry
     */
    async add(data) {
        return this.create({
            name: data.name,
            birth_date: data.birth,
            phone: data.phone,
            contact_jid: data.jid || null,
            address: data.address,
            zip_code: data.cep,
            notes: data.notes,
            source: data.source || 'manual',
            is_active: 1
        });
    }

    /**
     * Delete a client by id.
     * @param {number|string} id
     * @returns {Promise<number>} Rows deleted
     */
    async remove(id) {
        return this.delete(id);
    }

    /**
     * Find a client by phone number or JID.
     * @param {string} identifier - Phone or JID
     * @returns {Promise<Object|null>}
     */
    async findByIdentifier(identifier) {
        return this.db.get(
            'SELECT * FROM clients WHERE company_id = ? AND (phone = ? OR contact_jid = ?)',
            [this.companyId, identifier, identifier]
        );
    }
}

module.exports = ClientRepository;
