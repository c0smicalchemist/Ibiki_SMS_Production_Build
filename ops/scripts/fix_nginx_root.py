import re

PATH = "/etc/nginx/sites-enabled/ibiki-sms"

with open(PATH, "r", encoding="utf-8") as f:
    txt = f.read()

changed = False

# Force site root to deployed directory
txt2 = re.sub(r"\broot\s+[^;]+;", "    root /opt/ibiki-sms/dist/public;", txt)
if txt2 != txt:
    txt = txt2
    changed = True

# Ensure assets location serves files and 404s missing ones
m = re.search(r"location\s+/assets/\s*\{[\s\S]*?\}", txt)
if m:
    block = m.group(0)
    block2 = re.sub(r"try_files\s+[^;]+;", "try_files $uri =404;", block)
    if block2 != block:
        txt = txt.replace(block, block2)
        changed = True

# Ensure HTML is no-store and falls back to index.html
if "location ~* \\.(html)" not in txt:
    ins = "\n    location ~* \\.(html)$ {\n        add_header Cache-Control \"no-store, must-revalidate\" always;\n        try_files $uri /index.html;\n    }\n"
    i = txt.find("index index.html;")
    if i != -1:
        txt = txt[:i + len("index index.html;")] + ins + txt[i + len("index index.html;"):]
        changed = True

if changed:
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(txt)
    print("PATCHED")
else:
    print("ALREADY_OK")

