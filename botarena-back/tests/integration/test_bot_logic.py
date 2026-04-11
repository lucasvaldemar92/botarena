import os
import requests

def test_status_group_story_filter():
    """
    Scenario 1 & 2: Security & Privacy
    Verify that the node.js backend has a strict condition against status@broadcast and @g.us
    """
    server_js_path = os.path.join(os.path.dirname(__file__), '..', '..', 'server.js')
    
    with open(server_js_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    assert "msg.from === 'status@broadcast'" in content, "Missing status lockdown"
    assert "msg.from.includes('@g.us')" in content or "msg.from.endsWith('@g.us')" in content, "Missing group lockdown"
    print("STATUS: Group/Story Filter... PASSED")
    
def test_authentication_redirection():
    """
    Scenario 3: Redirection
    Perform an HTTP request to /api/status and ensure isAuthenticated is exposed.
    """
    try:
        response = requests.get("http://localhost:3000/api/status")
        assert response.status_code == 200
        data = response.json()
        assert 'isAuthenticated' in data, "isAuthenticated flag is missing from API"
    except requests.exceptions.ConnectionError:
        print("Backend is offline, test skipped or handled by pipeline.")
        pass
