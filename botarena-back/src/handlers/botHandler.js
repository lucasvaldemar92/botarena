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
function setupBotHandler(client, io, isClientReadyFn, { settingsRepo, knowledgeRepo, menuRepo, ragRepo, orderRepo }) {
    const consumerService = require('../services/consumerService');

    client.removeAllListeners('message');
    client.removeAllListeners('message_create');
    client.on('message_create', async (msg) => {
        // 🛡️ Ignore WhatsApp status/stories — must be the FIRST check
        if (msg.isStatus) return;

        // Ignore messages sent by the system (fromMe) – Bot only reacts to external messages
        if (msg.fromMe === true || msg.id.fromMe === true) {
            return; // Completely ignore any message sent by the system/operator
        }

        // Task 1: Strict JID Lockdown
        if (msg.from === 'status@broadcast' || msg.from.includes('@g.us')) {
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
                // // console.log(`🍽️ [Bot] Cardápio trigger detected for ${contactId} (fromMe: ${msg.fromMe})`);
                const dailyMenu = await menuRepo.getLatestAsset();
                
                if (dailyMenu && dailyMenu.base64_data && dailyMenu.mimetype) {
                    // // console.log(`📦 [Bot] Found binary menu: ${dailyMenu.mimetype}, size: ${dailyMenu.base64_data.length} chars`);
                    try {
                        const { MessageMedia } = require('whatsapp-web.js');
                        const media = new MessageMedia(dailyMenu.mimetype, dailyMenu.base64_data, 'cardapio');
                        await client.sendMessage(contactId, media);
                        // // console.log(`🍽️ [Bot] Media menu sent SUCCESSFULLY to ${contactId}`);
                        return;
                    } catch (mediaErr) {
                        console.error('❌ [Bot] Error sending media menu:', mediaErr);
                    }
                } else {
                    // // console.log('⚠️ [Bot] No binary menu found in DB, falling back to text.');
                }

                if (dailyMenu?.extracted_text) {
                    await safeReply(msg, dailyMenu.extracted_text, isClientReadyFn);
                } else if (config.cardapio_url) {
                    await safeReply(msg, `📋 Confira nosso cardápio: ${config.cardapio_url}`, isClientReadyFn);
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
