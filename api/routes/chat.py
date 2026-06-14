from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
import anthropic
import os
import sys

load_dotenv(Path(__file__).parent.parent.parent / ".env")

sys.path.append(str(Path(__file__).parent.parent.parent))
from scripts.context_builder import get_context, get_rag_context

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    history: list = []

def get_system_prompt() -> str:
    prompt_path = Path(__file__).parent.parent.parent / "coach" / "system_prompt.txt"
    with open(prompt_path) as f:
        return f.read()

@router.post("/chat")
async def chat(request: ChatRequest):
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    
    träningskontext = get_context(veckor=12)
    rag_kontext = get_rag_context(request.message)
    
    system = get_system_prompt()
    system += f"\n\n== ANVÄNDARENS TRÄNINGSDATA ==\n{träningskontext}"
    if rag_kontext:
        system += f"\n{rag_kontext}"

    messages = request.history + [{"role": "user", "content": request.message}]

    def generate():
        with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=system,
            messages=messages
        ) as stream:
            for text in stream.text_stream:
                yield text

    return StreamingResponse(generate(), media_type="text/plain")