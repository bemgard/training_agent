import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent

def sync():
    print("🔄 Synkar Garmin-data...")
    subprocess.run([sys.executable, BASE_DIR / "scripts" / "sync_garmin.py"])

def coach():
    subprocess.run([sys.executable, "-m", "coach.coach"])

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Training Agent")
    parser.add_argument("--sync", action="store_true", help="Synka ny data från Garmin")
    parser.add_argument("--coach", action="store_true", help="Starta träningscoachen")
    args = parser.parse_args()

    if args.sync:
        sync()
    elif args.coach:
        coach()
    else:
        sync()
        print()
        coach()