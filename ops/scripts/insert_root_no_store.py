import re
import sys

PATH = "/etc/nginx/sites-enabled/ibiki-sms"
with open(PATH, "r", encoding="utf-8") as f:
    txt = f.read()

changed = False

# Ensure location / has no-store header
m = re.search(r"location\s+/\s*\{[\s\S]*?\}", txt)
if m:
    block = m.group(0)
    if "add_header Cache-Control" not in block:
        block2 = re.sub(r"\{", "{\n        add_header Cache-Control \"no-store, must-revalidate\" always;", block, count=1)
        txt = txt.replace(block, block2)
        changed = True

# Ensure HTML responses get no-store (in case location / is not used)
if "location ~* \\.(html)" not in txt:
    insert_after = re.search(r"index\s+index\.html;", txt)
    if insert_after:
        idx = insert_after.end()
        html_block = "\n    location ~* \\.(html)$ {\n        add_header Cache-Control \"no-store, must-revalidate\" always;\n        try_files $uri /index.html;\n    }\n"
        txt = txt[:idx] + html_block + txt[idx:]
        changed = True

if changed:
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(txt)
    print("PATCHED")
else:
    print("ALREADY_OK")

