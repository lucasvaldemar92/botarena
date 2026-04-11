const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Sending bad payload...');
    socket.emit('send_message', { body: 'Malicious payload', to: 'status@broadcast' });
    setTimeout(() => {
        socket.disconnect();
        process.exit(0);
    }, 1000);
});
