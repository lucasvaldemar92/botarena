const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log("Iniciando o bot...");

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('Escaneie o QR Code abaixo com o seu WhatsApp para conectar o bot:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot conectado e pronto para responder!');
});

const cardapioText = `*🍔 Bar e Lanchonete Arena Juvenal 🍻*

Aqui a resenha nunca para! Confira nosso cardápio:

*🍺 Bebidas*
• Torre de Chopp (2.5L) - R$ 45,00
• Cerveja Long Neck - R$ 12,00
• Sucos Naturais e Refri - R$ 8,00
• Caipirinha Juvenal - R$ 25,00

*🍟 Porções*
• Iscas de Frango Crocante - R$ 38,00
• Tábua Mista da Arena - R$ 65,00

*🍔 Lanches*
• Burguer do Artilheiro - R$ 32,00

Faça seu pedido no balcão!`;

client.on('message', msg => {
    const text = msg.body.toLowerCase();

    // Check if the message contains keywords for the menu
    if (text === '!cardapio' || text === 'menu' || text === 'cardapio' || text === 'cardápio') {
        msg.reply(cardapioText);
        console.log(`Cardápio enviado para ${msg.from}`);
    }
});

// Initialize the client
client.initialize();
