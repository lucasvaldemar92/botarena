const http = require('http');

const data = JSON.stringify({
    name: 'Teste via Terminal',
    birth: '1995-05-05',
    phone: '123456789',
    cep: '12345-678',
    address: 'Rua Terminal',
    notes: 'Teste',
    source: 'manual'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/clients',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('🚀 Iniciando teste de API...');

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log(`📡 Status: ${res.statusCode}`);
        console.log('📥 Resposta:', body);
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error(`❌ Erro: ${e.message}`);
    process.exit(1);
});

req.write(data);
req.end();
