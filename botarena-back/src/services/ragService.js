// ==========================================
// 🧠 RAG INGESTION SERVICE
// ==========================================
// Core RAG utility class managing text extraction, semantic chunking, and database indexing.
// Complies with isolated service architecture limits.

const fs = require('fs').promises;
const path = require('path');

class RagService {
    /**
     * @param {RagRepository} ragRepository - Injected RAG DB Repository
     */
    constructor(ragRepository) {
        this.ragRepository = ragRepository;
    }

    /**
     * Parses incoming PDF or Txt assets to extract raw text content.
     * Includes fallback parsing to extract strings from PDF data without external deps.
     * @param {string} filePath - Absolute path to the source file
     * @returns {Promise<string>} Extracted raw text
     */
    async extractTextFromFile(filePath) {
        if (!filePath) {
            throw new Error('File path is required for text extraction');
        }

        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.txt') {
            return await fs.readFile(filePath, 'utf8');
        } else if (ext === '.pdf') {
            const data = await fs.readFile(filePath);
            const text = data.toString('utf8');

            // Regex extraction to extract raw text streams in PDF objects
            const matches = text.match(/\(([^)]+)\)\s*(?:Tj|TJ)/g);
            if (matches && matches.length > 0) {
                return matches
                    .map(m => m.replace(/^\(|\)\s*(Tj|TJ)$/g, ''))
                    .join(' ')
                    .replace(/\\([0-3][0-7][0-7])/g, (match, octal) => String.fromCharCode(parseInt(octal, 8)))
                    .trim();
            }

            // Fallback: Clean binary structures and extract printable characters
            return text
                .replace(/[^\x20-\x7E\n\r\táéíóúçãõâêîôûàèìòùÁÉÍÓÚÇÃÕÂÊÎÔÛÀÈÌÒÙ]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        } else {
            throw new Error(`Unsupported file extension: ${ext}`);
        }
    }

    /**
     * Splits a document into optimized semantic chunks.
     * @param {string} rawText - Document source text
     * @param {number} [maxChunkSize=800] - Ideal max chunk size in characters
     * @param {number} [overlap=150] - Number of characters to overlap between chunks
     * @returns {Array<string>} Generated text chunks
     */
    generateSemanticChunks(rawText, maxChunkSize = 800, overlap = 150) {
        if (!rawText || typeof rawText !== 'string') {
            return [];
        }

        // Split raw text by double line breaks or carriage returns
        const sections = rawText.split(/\n\s*\n|\r\n\s*\r\n/);
        const chunks = [];
        let currentChunk = '';

        for (const section of sections) {
            const cleanedSection = section.trim();
            if (!cleanedSection) continue;

            // Handle oversized sections with overlap
            if (cleanedSection.length > maxChunkSize) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }

                let start = 0;
                while (start < cleanedSection.length) {
                    const end = Math.min(start + maxChunkSize, cleanedSection.length);
                    chunks.push(cleanedSection.substring(start, end).trim());
                    start += (maxChunkSize - overlap);
                }
            } else {
                // Accumulate chunks safely
                if ((currentChunk.length + cleanedSection.length + 1) > maxChunkSize) {
                    chunks.push(currentChunk.trim());
                    currentChunk = cleanedSection;
                } else {
                    currentChunk = currentChunk ? `${currentChunk}\n\n${cleanedSection}` : cleanedSection;
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        return chunks.filter(c => c.length > 0);
    }

    /**
     * Pipeline processing: extracts, chunks, and atomically saves document chunks to database.
     * @param {string} filePath - Absolute path to the source file
     * @param {string} sourceType - e.g., 'menu_slot', 'faq'
     * @param {string} sourceId - e.g., 'lunch', 'dinner', 'dessert'
     * @returns {Promise<Array<string>>} The generated chunks saved
     */
    async ingestDocument(filePath, sourceType, sourceId) {
        const rawText = await this.extractTextFromFile(filePath);
        const chunks = this.generateSemanticChunks(rawText);
        await this.ragRepository.saveChunks(sourceType, sourceId, chunks);
        return chunks;
    }
}

module.exports = RagService;
