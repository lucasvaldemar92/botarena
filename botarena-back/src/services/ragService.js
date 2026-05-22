const menuRepository = require('../repositories/menuRepository');
const ragRepository = require('../repositories/ragRepository');

class RagService {
    /**
     * SOURCE 1: menu-catalog -> Lê 100% dos produtos estruturados do banco (Açaí, Gelados, etc.)
     */
    async syncCatalogToRag() {
        try {
            const allProducts = await menuRepository.getAllActiveProducts();
            
            let catalogText = "=== CARDÁPIO DE PRODUTOS FIXOS (AÇAÍ, GELADOS, BEBIDAS) ===\n\n";
            allProducts.forEach(item => {
                // Filtra para garantir que o almoço diário não entre por aqui
                if (item.category !== 'almoco_executivo') {
                    catalogText += `Produto: ${item.name}\nPreço: R$ ${item.price.toFixed(2)}\n`;
                    if (item.description) catalogText += `Detalhes: ${item.description}\n`;
                    catalogText += `-----------------------------------\n`;
                }
            });

            await ragRepository.clearChunksByType('menu_catalog_fixed');
            await ragRepository.saveChunks([{
                sourceType: 'menu_catalog_fixed',
                sourceName: 'database_integrated_catalog',
                contentText: catalogText,
                metadata: { updatedAt: new Date().toISOString() }
            }]);

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

            // Limpa o almoço do dia anterior e grava o de hoje
            await ragRepository.clearChunksByType('menu_lunch_volatile');
            await ragRepository.saveChunks([{
                sourceType: 'menu_lunch_volatile',
                sourceName: sourceName,
                contentText: lunchText,
                metadata: { extractedAt: new Date().toISOString() }
            }]);

            return { success: true };
        } catch (error) {
            console.error("[RAG LUNCH UPDATE ERROR]:", error);
            throw error;
        }
    }
}

module.exports = new RagService();
