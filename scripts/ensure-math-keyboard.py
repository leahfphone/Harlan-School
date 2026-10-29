from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
for path in root.glob("math*.html"):
    if path.name == "math.html" or path.name == "math6-help-book.html" or re.fullmatch(r"math-chapter-[0-9]+.html", path.name):
        continue
    html = path.read_text(encoding="utf-8")
    if "math-keyboard.js" in html or not re.search(r"<(input|textarea)\b", html, re.I):
        continue
    html = re.sub(r"</body>", '<script src="math-keyboard.js?v=20261029-tapfix5"></script></body>', html, count=1, flags=re.I)
    path.write_text(html, encoding="utf-8")
