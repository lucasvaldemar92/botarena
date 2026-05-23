// ==========================================
// 🤖 BOT INTELLIGENCE (Smart Auto-Reply)
// ==========================================
const seenContacts = new Set();
const sanitizeHtml = require('sanitize-html');

/**
 * safeReply — Wraps msg.reply() with a client readiness guard.
 * Prevents Puppeteer crashes when the client disconnects mid-session.
 * @param {Message} msg  - The incoming whatsapp-web.js message object
 * @param {string}  text - The reply text to send
 * @param {Function} isClientReadyFn - Returns true when client is ready
 * @returns {Promise<boolean>} true if sent, false if blocked
 */
async function safeReply(msg, text, isClientReadyFn) {
    if (!isClientReadyFn()) {
        console.error('🚫 [Bot] safeReply blocked — client not ready. Message was:', text.substring(0, 60));
        return false;
    }
    try {
        await msg.reply(text);
        return true;
    } catch (err) {
        console.error('❌ [Bot] safeReply failed:', err.message);
        return false;
    }
}

/**
 * setupBotHandler — Attaches the message_create listener to the WhatsApp client.
 * @param {Client} client - whatsapp-web.js client instance
 * @param {Server} io     - Socket.IO server instance
 * @param {Function} isClientReadyFn - Returns true when client is ready
 * @param {Object} repos  - Injected repository instances
 * @param {Object} repos.settingsRepo
 * @param {Object} repos.knowledgeRepo
 * @param {Object} repos.menuRepo
 */
function setupBotHandler(client, io, isClientReadyFn, { settingsRepo, knowledgeRepo, menuRepo, ragRepo, orderRepo, catalogRepo }) {
    const consumerService = require('../services/consumerService');

    client.removeAllListeners('message');
    client.removeAllListeners('message_create');
    client.on('message_create', async (msg) => {
        // 🛡️ Ignore WhatsApp status/stories — must be the FIRST check
        if (msg.isStatus) return;

        // Task 1: Strict JID Lockdown
        const targetJid = msg.fromMe ? msg.to : msg.from;
        if (!targetJid || targetJid === 'status@broadcast' || targetJid.includes('@g.us')) {
            return;
        }

        if (msg.body) {
            msg.body = sanitizeHtml(msg.body, { allowedTags: [], allowedAttributes: {} });
            
            // --- Contact Sync Logic (Step 3) ---
            try {
                const contact = await msg.getContact();
                io.emit('whatsapp_contact_sync', {
                    name: contact.name || contact.pushname || '',
                    phone: contact.number || '',
                    jid: contact.id._serialized
                });
            } catch (err) {
                console.error('❌ [Sync] Error fetching contact for sync:', err.message);
            }

            io.emit('new_message', {
                id:        msg.id._serialized,
                from:      msg.from,
                to:        msg.to,
                body:      msg.body,
                fromMe:    msg.fromMe,
                timestamp: msg.timestamp
            });
        }

        // Ignore messages sent by the system (fromMe) – Bot only reacts to external messages
        if (msg.fromMe === true || msg.id.fromMe === true) {
            return; // Completely ignore any message sent by the system/operator for bot response
        }

        if (!msg.body) return;

        try {
            const config = await settingsRepo.get();

            if (!config.bot_active) {
                return;
            }

            const contactId = msg.fromMe ? msg.to : msg.from;

            // Schedule Validation (Operation Hours)
            const now = new Date();
            const currentDay = now.getDay().toString(); // 0 (Sun) to 6 (Sat)
            const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            const msgAusencia = config.mensagem_ausencia || 'No momento estamos fora do horário de atendimento. Deixe sua mensagem e retornaremos em breve.';

            let isOperatingTime = false;
            let periods = [];
            
            try {
                if (config.operation_periods) {
                    periods = JSON.parse(config.operation_periods);
                } else if (config.operation_start) {
                    // Fallback to legacy single period
                    periods = [{
                        days: config.operation_days || '1,2,3,4,5',
                        start: config.operation_start,
                        end: config.operation_end
                    }];
                }
            } catch (e) {
                console.error('❌ [Bot] Failed to parse operation_periods:', e.message);
            }

            // If no periods defined, assume 24/7 or fallback behavior. Let's assume 24/7 if empty.
            if (!periods || periods.length === 0) {
                isOperatingTime = true;
            } else {
                for (const period of periods) {
                    const opDays = period.days ? period.days.split(',') : [];
                    if (opDays.includes(currentDay) && currentTime >= period.start && currentTime <= period.end) {
                        isOperatingTime = true;
                        break;
                    }
                }
            }

            if (!isOperatingTime) {
                if (!seenContacts.has(contactId)) {
                    seenContacts.add(contactId);
                    await safeReply(msg, msgAusencia, isClientReadyFn);
                    // // console.log(`⏰ [Bot] Outside operation hours (${currentDay} ${currentTime}). Absence message sent to ${contactId}`);
                }
                return; // Do not process other commands outside hours
            }

            // Welcome message (first contact only inside operation hours)
            if (!seenContacts.has(contactId)) {
                seenContacts.add(contactId);
                const greeting = (config.boas_vindas || 'Olá! Como podemos ajudar?')
                    .replace(/\{\{empresa\}\}/g, config.empresa || 'BotArena');
                await safeReply(msg, greeting, isClientReadyFn);
            }

            const text = msg.body.toLowerCase().trim();

            // Cardápio trigger (Dynamic Asset Management)
            if (['cardapio', 'cardápio', 'menu', '!cardapio'].includes(text)) {
                const dailyMenu = await menuRepo.getLatestAsset();
                if (dailyMenu && dailyMenu.base64_data && dailyMenu.mimetype) {
                    try {
                        const { MessageMedia } = require('whatsapp-web.js');
                        const media = new MessageMedia(dailyMenu.mimetype, dailyMenu.base64_data, 'cardapio');
                        await client.sendMessage(contactId, media);
                        return;
                    } catch (mediaErr) {
                        console.error('❌ [Bot] Error sending media menu:', mediaErr);
                    }
                }

                if (dailyMenu?.extracted_text) {
                    await safeReply(msg, dailyMenu.extracted_text, isClientReadyFn);
                } else if (config.cardapio_url) {
                    await safeReply(msg, `📋 Confira nosso cardápio completo: ${config.cardapio_url}`, isClientReadyFn);
                } else {
                    await safeReply(msg, 'Nosso cardápio ainda não está disponível. Tente novamente mais tarde!', isClientReadyFn);
                }
                return;
            }

            // Pix trigger
            if (text.includes('pix') && config.pix) {
                await safeReply(msg, `💰 Nossa chave PIX é: ${config.pix}`, isClientReadyFn);
                return;
            }

            // Consumer Integration Test Trigger
            if (text === 'testar consumer') {
                if (!config.consumer_integration_active) {
                    await safeReply(msg, 'A integração com o Programa Consumer está desativada no Painel.', isClientReadyFn);
                    return;
                }
                await safeReply(msg, '⏳ Montando carrinho de teste e enviando para o Consumer PDV...', isClientReadyFn);
                
                const mockOrder = {
                    customer_name: 'Cliente Teste WhatsApp',
                    customer_phone: contactId,
                    customer_address: 'Rua das Flores, 123',
                    neighborhood: 'Centro',
                    payment_method: 'PIX',
                    total: 45.90,
                    delivery_fee: 5.00,
                    status: 'novo',
                    items: [
                        { pdv_code: '1001', name: 'Pizza Teste', quantity: 1, price: 40.90, notes: 'Sem cebola' }
                    ]
                };

                // Save internal order
                let savedOrder = null;
                if (orderRepo) {
                    try {
                        savedOrder = await orderRepo.create(mockOrder);
                        io.emit('new_order', { ...mockOrder, id: savedOrder.id, numero_pedido: savedOrder.numero_pedido });
                    } catch (dbErr) {
                        console.error('❌ Erro ao salvar pedido mock:', dbErr);
                    }
                }

                // Adapter payload to consumer if active
                const consumerPayload = {
                    customerName: mockOrder.customer_name,
                    customerPhone: mockOrder.customer_phone,
                    address: mockOrder.customer_address + ' - ' + mockOrder.neighborhood,
                    paymentMethod: mockOrder.payment_method,
                    totalAmount: mockOrder.total,
                    deliveryFee: mockOrder.delivery_fee,
                    items: mockOrder.items.map(i => ({ codigo_pdv: i.pdv_code, name: i.name, quantity: i.quantity, price: i.price, notes: i.notes }))
                };

                const result = await consumerService.sendOrder(consumerPayload, config);
                if (result.success) {
                    if (savedOrder && orderRepo) {
                        // Poderiamos salvar o consumer_order_id aqui depois se quisessemos
                    }
                    await safeReply(msg, `✅ Pedido injetado no Consumer com sucesso! ID: ${result.consumer_order_id}`, isClientReadyFn);
                } else {
                    await safeReply(msg, `❌ Falha ao enviar para o PDV: ${result.reason}`, isClientReadyFn);
                }
                return;
            }

            // --- DETECTOR DE PEDIDOS E ADICIONAIS DINÂMICOS ---
            if (catalogRepo) {
                try {
                    const allItems = await catalogRepo.findAll();
                    const normais = allItems.filter(i => i.is_adicional === 0 && i.disponivel === 1);
                    const adicionais = allItems.filter(i => i.is_adicional === 1 && i.disponivel === 1);

                    const normalizeText = (str) => {
                        return str.toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .replace(/[^\w\s]/gi, '')
                            .trim();
                    };

                    const normalizedMsg = normalizeText(text);

                    // Procura match de todos os produtos principais citados na mensagem
                    const matchedProducts = [];
                    for (const prod of normais) {
                        const normalizedProdName = normalizeText(prod.nome);
                        const prodRegex = new RegExp('\\b' + normalizedProdName + '\\b', 'i');
                        if (prodRegex.test(normalizedMsg) || (prod.cod_pdv && normalizedMsg.includes(prod.cod_pdv))) {
                            matchedProducts.push(prod);
                        }
                    }

                    if (matchedProducts.length > 0) {
                        const orderKeywords = ['quero', 'pedir', 've', 'vê', 'vou', 'gostaria', 'pegar', 'comprar', 'me da', 'me dá', 'adiciona'];
                        const isOrderIntent = orderKeywords.some(kw => normalizedMsg.includes(kw));

                        if (isOrderIntent) {
                            let confirmText = `🛒 *Confirmando sua escolha:*\n\n`;
                            let grandTotal = 0;

                            for (const product of matchedProducts) {
                                const descParts = product.descricao ? product.descricao.split(' ||| ') : [];
                                const meta = descParts[1] ? JSON.parse(descParts[1]) : {};
                                const adIds = meta.adicionalIds || [];

                                const matchedAdicionais = [];
                                let adicionaisPrecoTotal = 0;

                                if (adIds.length > 0) {
                                    const vinculados = adicionais.filter(a => adIds.includes(a.id) || adIds.includes(String(a.id)));
                                    for (const ad of vinculados) {
                                        const normalizedAdName = normalizeText(ad.nome);
                                        const adRegex = new RegExp('\\b' + normalizedAdName + '\\b', 'i');
                                        if (adRegex.test(normalizedMsg)) {
                                            matchedAdicionais.push(ad);
                                            adicionaisPrecoTotal += Number(ad.preco);
                                        }
                                    }
                                }

                                const basePrice = Number(product.preco);
                                const productTotal = basePrice + adicionaisPrecoTotal;
                                grandTotal += productTotal;

                                const basePriceStr = basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                
                                confirmText += `🍔 *${product.nome}* - ${basePriceStr}\n`;
                                if (matchedAdicionais.length > 0) {
                                    matchedAdicionais.forEach(ad => {
                                        const adPriceStr = Number(ad.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                        confirmText += `  ➕ *${ad.nome}* (+ ${adPriceStr})\n`;
                                    });
                                }
                                confirmText += `\n`;
                            }

                            const grandTotalStr = grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            confirmText += `💰 *Valor Total: ${grandTotalStr}*\n\n`;
                            confirmText += `Confirmamos o pedido! Gostaria de adicionar mais alguma coisa ou deseja finalizar o pedido?`;

                            await safeReply(msg, confirmText, isClientReadyFn);
                            return;
                        } else {
                            // Consulta simples de múltiplos itens
                            let infoText = matchedProducts.length === 1 ? `📋 *Informações do item:*\n\n` : `📋 *Informações dos itens solicitados:*\n\n`;

                            for (const product of matchedProducts) {
                                const descParts = product.descricao ? product.descricao.split(' ||| ') : [];
                                const cleanDesc = descParts[0] || '';
                                const meta = descParts[1] ? JSON.parse(descParts[1]) : {};
                                const adIds = meta.adicionalIds || [];

                                const basePrice = Number(product.preco);
                                const basePriceStr = basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                                infoText += `🍔 *${product.nome}* - _${basePriceStr}_\n`;
                                if (cleanDesc) {
                                    infoText += `_${cleanDesc}_\n`;
                                }

                                if (adIds.length > 0) {
                                    const vinculados = adicionais.filter(a => adIds.includes(a.id) || adIds.includes(String(a.id)));
                                    if (vinculados.length > 0) {
                                        infoText += `*Adicionais disponíveis:* `;
                                        infoText += vinculados.map(ad => `${ad.nome} (+ R$ ${Number(ad.preco).toFixed(2)})`).join(', ');
                                        infoText += `\n`;
                                    }
                                }
                                infoText += `\n`;
                            }

                            if (matchedProducts.length === 1) {
                                infoText += `🛵 Para pedir este item, digite por exemplo: "Quero um ${matchedProducts[0].nome}"`;
                            } else {
                                infoText += `🛵 Para pedir estes itens, digite por exemplo: "Quero um ${matchedProducts[0].nome} e um ${matchedProducts[1].nome}"`;
                            }

                            await safeReply(msg, infoText, isClientReadyFn);
                            return;
                        }
                    }
                } catch (err) {
                    console.error('Erro ao processar pedido dinâmico no bot:', err);
                }
            }

            // Reconhecimento de fechamento de pedido se o usuário disser que é somente isso
            if (['somente isso', 'so isso', 'finalizar', 'fechar', 'fechar pedido', 'concluir'].some(kw => text.includes(kw))) {
                await safeReply(msg, `🏁 *Perfeito!* Vamos fechar o seu pedido. Por favor, nos informe a forma de pagamento (PIX, Cartão ou Dinheiro) e o endereço de entrega completo. 🛵`, isClientReadyFn);
                return;
            }

            // Knowledge Base lookup
            const kbMatch = await knowledgeRepo.findByKeyword(text);
            if (kbMatch) {
                await safeReply(msg, kbMatch.response, isClientReadyFn);
                return;
            }

            // RAG Semantic / Keyword Search Lookup
            if (ragRepo) {
                try {
                    const matches = await ragRepo.searchChunks(text, 1);
                    if (matches && matches.length > 0) {
                        const match = matches[0];
                        let replyText = '';
                        if (match.source_type === 'menu_slot') {
                            const slotNames = { lunch: 'Almoço', dinner: 'Jantar', dessert: 'Sobremesa' };
                            const slotLabel = slotNames[match.source_id] || match.source_id;
                            replyText = `🍽️ *Encontrei a seguinte informação no Cardápio de ${slotLabel}:*\n\n${match.content}`;
                        } else if (match.source_type === 'faq') {
                            replyText = `💡 *Encontrei isto na nossa Central de Ajuda:*\n\n${match.content}`;
                        } else {
                            replyText = `${match.content}`;
                        }
                        
                        await safeReply(msg, replyText, isClientReadyFn);
                        return;
                    }
                } catch (ragErr) {
                    console.error('❌ [Bot] RAG Search failed:', ragErr);
                }
            }

            // // console.log(`🔍 [Bot] No keyword match for: "${text.substring(0, 50)}"`);

        } catch (err) {
            console.error('❌ [Bot] Error in auto-reply:', err);
        }
    });
}

module.exports = { setupBotHandler };
