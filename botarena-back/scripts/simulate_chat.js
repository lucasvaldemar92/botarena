const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('✅ Simulação: Conectado ao Servidor do Bot.');
    
    const mockMessage = {
        from: '5511999999999@c.us',
        body: 'Olá, gostaria de ver o cardápio!',
        pushname: 'Cliente Simulado'
    };

    console.log(`💬 Simulação: Enviando mensagem: "${mockMessage.body}"`);
    
    // Injeta a mensagem no sistema via socket para o bot processar
    socket.emit('simulate_inbound_message', mockMessage);

    setTimeout(() => {
        console.log('🏁 Simulação enviada. Verifique o dashboard/chat!');
        process.exit(0);
    }, 2000);
});
