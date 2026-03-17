import os
import time
import webbrowser
from pathlib import Path

# Target file to watch
FILE_TO_WATCH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chat.html")
BROWSER_OPENED = False

def get_last_modified():
    try:
        return os.path.getmtime(FILE_TO_WATCH)
    except FileNotFoundError:
        return 0

def start_live_preview():
    global BROWSER_OPENED
    last_mtime = get_last_modified()
    
    file_path = f"file:///{FILE_TO_WATCH.replace(chr(92), '/')}"
    
    print(f"🚀 [BotArena] Monitorando {FILE_TO_WATCH}...")
    
    # Open the browser
    webbrowser.open(file_path)
    BROWSER_OPENED = True

    try:
        while True:
            current_mtime = get_last_modified()
            if current_mtime != last_mtime and current_mtime != 0:
                print(f"🔄 Alteração detectada em {FILE_TO_WATCH}! Atualizando navegador...")
                webbrowser.open(file_path)
                last_mtime = current_mtime
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Monitoramento encerrado.")

if __name__ == "__main__":
    start_live_preview()
