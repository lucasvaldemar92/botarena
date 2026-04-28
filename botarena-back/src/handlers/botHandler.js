// ==========================================
// 🤖 BOT INTELLIGENCE (Smart Auto-Reply)
// ==========================================
const seenContacts = new Set();

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
function setupBotHandler(client, io, isClientReadyFn, { settingsRepo, knowledgeRepo, menuRepo }) {
    client.removeAllListeners('message');
    client.removeAllListeners('message_create');
    client.on('message_create', async (msg) => {
        // Ignore messages sent by the system (fromMe) – Bot only reacts to external messages
        if (msg.fromMe === true || msg.id.fromMe === true) {
            return; // Completely ignore any message sent by the system/operator
        }

        // Task 1: Strict JID Lockdown
        if (msg.from === 'status@broadcast' || msg.from.includes('@g.us')) {
            console.log("🚫 [Bot] Ignorando Status/Grupo para evitar spam.");
            return;
        }

        console.log(`💬 [WhatsApp] Message ${msg.fromMe ? 'Sent' : 'Received'} - ID: ${msg.id.id}`);

        if (msg.body) {
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
                console.log('🔇 [Bot] Bot is OFF — skipping auto-reply.');
                return;
            }

            const contactId = msg.fromMe ? msg.to : msg.from;

            // Welcome message (first contact only)
            if (!seenContacts.has(contactId)) {
                seenContacts.add(contactId);
                const greeting = (config.boas_vindas || 'Olá! Como podemos ajudar?')
                    .replace(/\{\{empresa\}\}/g, config.empresa || 'BotArena');
                const sent = await safeReply(msg, greeting, isClientReadyFn);
                if (sent) console.log(`👋 [Bot] Welcome message sent to ${contactId}`);
            }

            const text = msg.body.toLowerCase().trim();

            // Cardápio trigger (Dynamic Asset Management)
            if (['cardapio', 'cardápio', 'menu', '!cardapio'].includes(text)) {
                console.log(`🍽️ [Bot] Cardápio trigger detected for ${contactId} (fromMe: ${msg.fromMe})`);
                const dailyMenu = await menuRepo.getLatestAsset();
                
                if (dailyMenu && dailyMenu.base64_data && dailyMenu.mimetype) {
                    console.log(`📦 [Bot] Found binary menu: ${dailyMenu.mimetype}, size: ${dailyMenu.base64_data.length} chars`);
                    try {
                        const { MessageMedia } = require('whatsapp-web.js');
                        const media = new MessageMedia(dailyMenu.mimetype, dailyMenu.base64_data, 'cardapio');
                        await client.sendMessage(contactId, media);
                        console.log(`🍽️ [Bot] Media menu sent SUCCESSFULLY to ${contactId}`);
                        return;
                    } catch (mediaErr) {
                        console.error('❌ [Bot] Error sending media menu:', mediaErr);
                    }
                } else {
                    console.log('⚠️ [Bot] No binary menu found in DB, falling back to text.');
                }

                if (dailyMenu?.extracted_text) {
                    if (await safeReply(msg, dailyMenu.extracted_text, isClientReadyFn))
                        console.log(`🍽️ [Bot] Daily menu (text) sent to ${contactId}`);
                } else if (config.cardapio_url) {
                    if (await safeReply(msg, `📋 Confira nosso cardápio: ${config.cardapio_url}`, isClientReadyFn))
                        console.log(`🔗 [Bot] Cardápio URL sent to ${contactId}`);
                } else {
                    await safeReply(msg, 'Nosso cardápio ainda não está disponível. Tente novamente mais tarde!', isClientReadyFn);
                }
                return;
            }

            // Pix trigger
            if (text.includes('pix') && config.pix) {
                if (await safeReply(msg, `💰 Nossa chave PIX é: ${config.pix}`, isClientReadyFn))
                    console.log(`💰 [Bot] Pix key sent to ${contactId}`);
                return;
            }

            // Knowledge Base lookup
            const kbMatch = await knowledgeRepo.findByKeyword(text);
            if (kbMatch) {
                if (await safeReply(msg, kbMatch.response, isClientReadyFn))
                    console.log(`📚 [Bot] KB match "${kbMatch.keyword}" → replied to ${contactId}`);
                return;
            }

            console.log(`🔍 [Bot] No keyword match for: "${text.substring(0, 50)}"`);

        } catch (err) {
            console.error('❌ [Bot] Error in auto-reply:', err);
        }
    });
}

module.exports = { setupBotHandler };
