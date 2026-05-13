#!/usr/bin/env python3
"""
cron_cards.py — runs due Custom AI Cards via Gemini.

Run from crontab or systemd timer, once per hour is enough:
  0 * * * * /home/deploy/warmcare/venv/bin/python /home/deploy/warmcare/backend/cron_cards.py

Or a more targeted schedule (e.g. 6 AM daily):
  0 6 * * * /home/deploy/warmcare/venv/bin/python /home/deploy/warmcare/backend/cron_cards.py

Requires:
  GEMINI_API_KEY env var (reads from .env via python-dotenv if available)
"""

import sys
import os

# Load .env from the project root if present
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass  # python-dotenv optional

# Add app to path
sys.path.insert(0, os.path.dirname(__file__))

from app.custom_cards import run_due_cards

if __name__ == "__main__":
    n = run_due_cards()
    print(f"[cron_cards] processed {n} card(s)")
