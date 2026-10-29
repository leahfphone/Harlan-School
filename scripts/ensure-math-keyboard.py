#!/usr/bin/env python3
"""Add the shared math keypad to future student math HTML pages.

Safe to rerun: never duplicates the script or modifies answers/grading.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
KEYBOARD = '<script src="math-keyboard.js?v=20261029-tapfix5"></script>'
COUNT = 0
for path in ROOT.rglob("*.html"):
    rel = path.relative_to(ROOT)
    if any(part.startswith(".") for part in rel.parts):
        continue
    name = path.name.lower()
    if not (name.startswith("math") or name.startswith("harlan-math")):
        continue
    if name in ("math.html", "math6-help-book.html") or re.fullmatch(r"math-chapter-\d+\.html", name):
        continue
    html = path.read_text(encoding="utf-8")
    if "math-keyboard.js" in html:
        continue
    if not re.search(r"<(?:input|textarea)\b", html, flags=re.I):
        continue
    if not re.search(r"</body\s*>", html, flags=re.I):
        print(f"WARNING: no body close in {rel}")
        continue
    updated = re.sub(r"</body\s*>", lambda m: KEYBOARD + m.group(0), html, count=1, flags=re.I)
    path.write_text(updated, encoding="utf-8")
    print(f"Added keypad: {rel}")
    COUNT += 1
print(f"Math pages updated: {COUNT}")
