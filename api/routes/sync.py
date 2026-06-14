from fastapi import APIRouter
import subprocess
import sys
from pathlib import Path

router = APIRouter()

@router.post("/sync")
def sync():
    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent.parent.parent / "scripts" / "sync_garmin.py")],
        capture_output=True,
        text=True
    )
    return {"output": result.stdout, "error": result.stderr}