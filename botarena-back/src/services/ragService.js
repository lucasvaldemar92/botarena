const fs = require('fs').promises;

class RagService {
    constructor(ragRepo) {
        this.ragRepo = ragRepo;
    }

    /**
     * Splits text into overlapping semantic chunks
     * @param {string} text 
     * @param {number} maxChunkSize 
     * @param {number} overlap 
     * @returns {Array<string>}
     */
    generateSemanticChunks(text, maxChunkSize = 1000, overlap = 200) {
        if (!text) return [];
        const blocks = text.split(/\n\s*\n/);
        
        if (blocks.length > 1 && blocks.every(b => b.length <= maxChunkSize)) {
            return blocks.map(b => b.trim()).filter(b => b);
        }
        
        const chunks = [];
        for (let i = 0; i < text.length; i += (maxChunkSize - overlap)) {
            chunks.push(text.substring(i, i + maxChunkSize));
        }
        return chunks;
    }

    /**
     * Extracts text from plain text files
     * @param {string} filePath 
     * @returns {Promise<string>}
     */
    async extractTextFromFile(filePath) {
        return await fs.readFile(filePath, 'utf8');
    }

    /**
     * SOURCE 1: menu-catalog -> Lê 100% dos produtos estruturados do banco (Açaí, Gelados, etc.)
     */
    async syncCatalogToRag() {
        let menuRepoInst;
        try {
            const container = require('../container');
            menuRepoInst = container.menuRepo;
        } catch (e) {
            console.warn('Fallback: container not available, RAG sync may fail.');
        }

        try {
            const allProducts = await menuRepoInst.getAllActiveProducts();
            
            let catalogText = "=== CARDÁPIO DE PRODUTOS FIXOS (AÇAÍ, GELADOS, BEBIDAS) ===\n\n";
            if (allProducts && allProducts.forEach) {
                allProducts.forEach(item => {
                    if (item.category !== 'almoco_executivo') {
                        catalogText += `Produto: ${item.name}\nPreço: R$ ${item.price.toFixed(2)}\n`;
                        if (item.description) catalogText += `Detalhes: ${item.description}\n`;
                        catalogText += `-----------------------------------\n`;
                    }
                });
            }

            await this.ragRepo.deleteChunksBySource('menu_catalog_fixed', 'database_integrated_catalog');
            await this.ragRepo.saveChunks('menu_catalog_fixed', 'database_integrated_catalog', [catalogText]);

            return { success: true };
        } catch (error) {
            console.error("[RAG CATALOG SYNC ERROR]:", error);
            throw error;
        }
    }

    /**
     * SOURCE 2: menu-management -> Lê APENAS o bloco volátil do Almoço do dia (via tela)
     */
    async updateDailyLunchRag(rawText, sourceName = 'daily_input') {
        try {
            let lunchText = `=== CARDÁPIO DE ALMOÇO DO DIA (${new Date().toLocaleDateString('pt-BR')}) ===\n\n`;
            lunchText += rawText.trim();

            await this.ragRepo.deleteChunksBySource('menu_lunch_volatile', sourceName);
            await this.ragRepo.saveChunks('menu_lunch_volatile', sourceName, [lunchText]);

            return { success: true };
        } catch (error) {
            console.error("[RAG LUNCH UPDATE ERROR]:", error);
            throw error;
        }
    }

    /**
     * SOURCE 3: company_address -> Lê os dados de endereço e localização da empresa
     * @param {Object} settings 
     * @returns {Promise<Object>}
     */
    async syncAddressToRag(settings) {
        try {
            if (!settings) return { success: false, reason: 'Nenhuma configuração fornecida' };

            let addressText = `=== DADOS E ENDEREÇO DA EMPRESA ===\n`;
            addressText += `Nome Fantasia: ${settings.trade_name || settings.empresa || 'BotArena'}\n`;
            if (settings.company_name) addressText += `Razão Social: ${settings.company_name}\n`;
            if (settings.cnpj) addressText += `CNPJ: ${settings.cnpj}\n`;
            if (settings.company_phone) addressText += `WhatsApp: ${settings.company_phone}\n`;
            if (settings.company_email) addressText += `E-mail: ${settings.company_email}\n`;
            
            const logradouro = [
                settings.company_street,
                settings.company_number,
                settings.company_neighborhood
            ].filter(Boolean).join(', ');

            if (logradouro) addressText += `Endereço: ${logradouro}\n`;
            if (settings.base_cep) addressText += `CEP: ${settings.base_cep}\n`;
            
            if (settings.latitude !== undefined && settings.latitude !== null && settings.longitude !== undefined && settings.longitude !== null) {
                addressText += `Coordenadas: Lat ${settings.latitude}, Lng ${settings.longitude}\n`;
            }

            // Deleta o chunk antigo e salva o novo
            await this.ragRepo.deleteChunksBySource('address', 'company_address');
            await this.ragRepo.saveChunks('address', 'company_address', [addressText.trim()]);

            return { success: true };
        } catch (error) {
            console.error("[RAG ADDRESS SYNC ERROR]:", error);
            throw error;
        }
    }
}

module.exports = RagService;
