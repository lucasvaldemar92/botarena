const fetch = require('node-fetch');

async function test() {
    const payload = {
        name: 'Teste via Terminal',
        birth: '1995-05-05',
        phone: '123456789',
        cep: '12345-678',
        address: 'Rua Terminal',
        notes: 'Teste',
        source: 'manual'
    };

    console.log('🚀 Enviando requisição para http://localhost:3000/api/clients...');
    
    try {
        const response = await fetch('http://localhost:3000/api/clients', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
                // Nota: O authMiddleware pode barrar, mas se der 500 o erro aparece
            },
            body: JSON.stringify(payload)
        });

        const status = response.status;
        const data = await response.json();
        
        console.log(`📡 Status: ${status}`);
        console.log('📥 Resposta:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ Erro na requisição:', err.message);
    }
}

test();
