// const axios = require('axios'); // Descomentar quando formos pra prod

/**
 * Serviço de Integração com a API do Programa Consumer
 * Documentação de Referência (Simulada): POST /api/v1/orders
 */
class ConsumerService {
    constructor() {
        // Base URL da API do Consumer (exemplo hipotético, aguardando documentação oficial deles)
        this.baseURL = 'https://api.programaconsumer.com.br/v1';
    }

    /**
     * Tenta autenticar na API do Consumer para obter um Bearer Token.
     * Como estamos em modo simulação, retornamos um token falso caso as credenciais existam.
     */
    async authenticate(clientId, clientSecret) {
        if (!clientId || !clientSecret) {
            throw new Error('Credenciais do Consumer ausentes.');
        }

        console.log(`🔄 [ConsumerService] Autenticando com ClientID: ${clientId.substring(0, 5)}...`);
        
        // Simulação de chamada OAuth2
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve('mocked_oauth_token_123456');
            }, 500);
        });
    }

    /**
     * Envia um pedido fechado do WhatsApp para o PDV do Consumer.
     * @param {Object} order - Objeto do pedido gerado pelo Bot.
     * @param {Object} config - Configurações da empresa (settings) contendo as chaves.
     * @returns {Object} Resposta de sucesso ou erro.
     */
    async sendOrder(order, config) {
        if (!config.consumer_integration_active) {
            console.log('⚠️ [ConsumerService] Integração desativada. Pedido não enviado ao PDV.');
            return { success: false, reason: 'integration_disabled' };
        }

        try {
            // 1. Autenticar
            const token = await this.authenticate(config.consumer_client_id, config.consumer_client_secret);

            // 2. Mapear o payload do BotArena para o formato do Consumer
            const consumerPayload = {
                customer: {
                    name: order.customerName,
                    phone: order.customerPhone,
                    address: order.address
                },
                payment: {
                    method: order.paymentMethod, // Ex: 'PIX', 'DINHEIRO', 'CARTAO'
                    total: order.totalAmount,
                    delivery_fee: order.deliveryFee
                },
                items: order.items.map(item => ({
                    // Aqui usamos o brilhante "Código PDV" que o usuário sugeriu
                    pdv_code: item.codigo_pdv || '0000', 
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.price,
                    notes: item.notes || ''
                })),
                origin: 'WhatsApp BotArena'
            };

            console.log(`🚀 [ConsumerService] Enviando pedido para o PDV... Payload:`, JSON.stringify(consumerPayload, null, 2));

            // 3. Chamada real (Simulada no momento)
            // Em produção seria: 
            // await axios.post(`${this.baseURL}/orders`, consumerPayload, { headers: { Authorization: `Bearer ${token}` } });
            
            return new Promise((resolve) => {
                setTimeout(() => {
                    console.log('✅ [ConsumerService] Pedido INJETADO com sucesso no Consumer!');
                    resolve({ success: true, consumer_order_id: 'CSM-' + Date.now() });
                }, 800);
            });

        } catch (error) {
            console.error('❌ [ConsumerService] Erro ao integrar pedido:', error.message);
            return { success: false, reason: error.message };
        }
    }
}

module.exports = new ConsumerService();
