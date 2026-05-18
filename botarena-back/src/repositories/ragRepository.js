// ==========================================
// 🏛️ RAG REPOSITORY
// ==========================================
// Encapsulates all SQL query execution for the `rag_chunks` table.
// Extends BaseRepository to leverage multi-tenant queries.

const BaseRepository = require('./BaseRepository');

class RagRepository extends BaseRepository {
    constructor(db, companyId) {
        super(db, 'rag_chunks', companyId);
    }

    /**
     * Atomically replaces existing chunks for a given source.
     * @param {string} sourceType - e.g., 'menu_slot', 'faq'
     * @param {string} sourceId   - e.g., 'lunch', 'dinner', 'dessert'
     * @param {Array<string>} chunks - List of text content chunks
     * @returns {Promise<void>}
     */
    async saveChunks(sourceType, sourceId, chunks) {
        await this.db.transaction(async () => {
            // Delete existing chunks for this specific document/source
            await this.db.run(
                `DELETE FROM rag_chunks WHERE company_id = ? AND source_type = ? AND source_id = ?`,
                [this.companyId, sourceType, sourceId]
            );

            // Insert new chunks
            for (let i = 0; i < chunks.length; i++) {
                await this.create({
                    source_type: sourceType,
                    source_id: sourceId,
                    chunk_index: i,
                    content: chunks[i]
                });
            }
        });
    }

    /**
     * Retrieves all chunks associated with a source, ordered by index.
     * @param {string} sourceType
     * @param {string} sourceId
     * @returns {Promise<Array<Object>>}
     */
    async getChunksBySource(sourceType, sourceId) {
        return this.db.all(
            `SELECT * FROM rag_chunks WHERE company_id = ? AND source_type = ? AND source_id = ? ORDER BY chunk_index ASC`,
            [this.companyId, sourceType, sourceId]
        );
    }

    /**
     * Performs a local keyword search over the semantic chunks.
     * @param {string} queryText - Search terms
     * @param {number} [limit=5] - Max results
     * @returns {Promise<Array<Object>>}
     */
    async searchChunks(queryText, limit = 5) {
        const keyword = `%${queryText}%`;
        return this.db.all(
            `SELECT * FROM rag_chunks WHERE company_id = ? AND content LIKE ? ORDER BY id ASC LIMIT ?`,
            [this.companyId, keyword, limit]
        );
    }

    /**
     * Deletes all chunks associated with a source.
     * @param {string} sourceType
     * @param {string} sourceId
     * @returns {Promise<number>} Number of deleted rows
     */
    async deleteChunksBySource(sourceType, sourceId) {
        const result = await this.db.run(
            `DELETE FROM rag_chunks WHERE company_id = ? AND source_type = ? AND source_id = ?`,
            [this.companyId, sourceType, sourceId]
        );
        return result.changes;
    }
}

module.exports = RagRepository;
