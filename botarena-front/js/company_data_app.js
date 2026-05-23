/**
 * 🏢 company_data_app.js
 * 
 * CEP Automation Pipeline with Local SQLite Database Cache Integration.
 * Intercepts and bypasses redundant network requests to ViaCEP.
 */

(function() {
    let initialCep = '';

    function sanitizeCep(value) {
        if (!value) return '';
        return value.replace(/\D/g, '');
    }

    document.addEventListener('DOMContentLoaded', () => {
        const cepInput = document.getElementById('base-cep') || document.getElementById('company-base-cep');
        if (!cepInput) return;

        // Captura o valor inicial se já estiver presente
        if (cepInput.value) {
            initialCep = sanitizeCep(cepInput.value);
        }

        // Escuta o preenchimento inicial vindo do banco SQLite
        window.addEventListener('configLoaded', (e) => {
            const config = e.detail;
            if (config && config.base_cep) {
                initialCep = sanitizeCep(config.base_cep);
                console.log(`ℹ️ [ViaCEP Pipeline] CEP inicial capturado do banco: ${initialCep}`);
            }
        });

        // Intercepta perda de foco (blur) para evitar requisições redundantes
        cepInput.addEventListener('blur', async () => {
            const rawValue = cepInput.value;
            const sanitizedCep = sanitizeCep(rawValue);

            if (!sanitizedCep) return;

            // Se o CEP for igual ao inicial, interrompe o fluxo e não chama o ViaCEP
            if (sanitizedCep === initialCep) {
                console.log(`⚡ [ViaCEP Pipeline] Bypass: CEP ${sanitizedCep} coincide com o CEP inicial. Chamada ao ViaCEP bloqueada.`);
                return;
            }

            console.log(`🔍 [ViaCEP Pipeline] CEP modificado detectado: ${sanitizedCep}. Buscando dados no ViaCEP...`);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${sanitizedCep}/json/`);
                if (!response.ok) throw new Error('Erro na requisição ao ViaCEP');
                const data = await response.json();

                if (data.erro) {
                    console.error(`❌ [ViaCEP Pipeline] CEP inexistente no ViaCEP: ${sanitizedCep}`);
                    return;
                }

                // Autopopula os campos de endereço no formulário
                const streetInput = document.getElementById('company-street');
                const neighborhoodInput = document.getElementById('company-neighborhood');

                if (streetInput && data.logradouro) streetInput.value = data.logradouro;
                if (neighborhoodInput && data.bairro) neighborhoodInput.value = data.bairro;

                // Sincroniza o CEP validado como novo CEP inicial para cache local
                initialCep = sanitizedCep;
                console.log(`✅ [ViaCEP Pipeline] Dados atualizados. Novo CEP sincronizado no cache: ${initialCep}`);
            } catch (err) {
                console.error('❌ [ViaCEP Pipeline] Falha ao consultar o ViaCEP:', err.message);
            }
        });
    });
})();
