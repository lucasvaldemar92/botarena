import requests
import json

BASE_URL = "http://localhost:3000/api"

def test_backend_config():
    print("🚀 Iniciando QA Check no Back-end do BotArena...")
    
    # 1. Testar o GET (Busca de Configuração)
    try:
        response = requests.get(f"{BASE_URL}/config")
        if response.status_code == 200:
            print("✅ GET /config: Sucesso!")
            print(f"📦 Dados atuais: {response.json()}")
        else:
            print(f"❌ GET /config: Falhou com status {response.status_code}")
    except Exception as e:
        print(f"🚨 Erro de conexão: O servidor Node.js está rodando na porta 3000? \n{e}")

    # 2. Testar o POST (Atualização de Dados da Arena)
    payload = {
        "empresa": "Arena Juvenal - Teste QA",
        "pix": "123.456.789-00",
        "bot_active": True
    }
    
    try:
        post_response = requests.post(f"{BASE_URL}/config", json=payload)
        if post_response.status_code == 200:
            print("✅ POST /config: Configuração atualizada com sucesso!")
        else:
            print(f"❌ POST /config: Erro ao atualizar.")
    except Exception as e:
        print(f"🚨 Erro no teste de POST: {e}")

if __name__ == "__main__":
    test_backend_config()
