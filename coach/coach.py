import anthropic
import sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")

sys.path.append(str(Path(__file__).parent.parent))
from scripts.context_builder import get_context

BASE_DIR = Path(__file__).parent.parent
SYSTEM_PROMPT_PATH = BASE_DIR / "coach" / "system_prompt.txt"

def get_system_prompt() -> str:
    with open(SYSTEM_PROMPT_PATH) as f:
        return f.read()

def chat():
    client = anthropic.Anthropic()
    system_prompt = get_system_prompt()
    träningskontext = get_context(veckor=12)
    
    full_system = f"{system_prompt}\n\n== ANVÄNDARENS TRÄNINGSDATA ==\n{träningskontext}"
    
    print("🏃 Träningscoachen är redo! Skriv 'avsluta' för att stänga.\n")
    
    messages = []
    
    while True:
        user_input = input("Du: ").strip()
        
        if user_input.lower() in ["avsluta", "exit", "quit"]:
            print("Hej då! Lycka till med träningen! 💪")
            break
            
        if not user_input:
            continue
        
        messages.append({"role": "user", "content": user_input})
        
        print("\nCoach: ", end="", flush=True)
        
        response_text = ""
        with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=4000,
            system=full_system,
            messages=messages
        ) as stream:
            for text in stream.text_stream:
                print(text, end="", flush=True)
                response_text += text
        
        print("\n")
        messages.append({"role": "assistant", "content": response_text})

if __name__ == "__main__":
    chat()