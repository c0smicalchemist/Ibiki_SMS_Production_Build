import re

PATH = "/etc/nginx/sites-enabled/ibiki-sms"

with open(PATH, "r", encoding="utf-8") as f:
    txt = f.read()

changed = False

# Ensure site root
txt2 = re.sub(r"\broot\s+[^;]+;", "    root /opt/ibiki-sms/dist/public;", txt)
if txt2 != txt:
    txt = txt2
    changed = True

# Build assets alias block
assets_block = (
    "    location /assets/ {\n"
    "        alias /opt/ibiki-sms/dist/public/assets/;\n"
    "        try_files $uri =404;\n"
    "        add_header Cache-Control \"no-store, must-revalidate\" always;\n"
    "    }\n"
)

m = re.search(r"location\s+/assets/\s*\{[\s\S]*?\}", txt)
if m:
    block = m.group(0)
    if block != assets_block:
        txt = txt.replace(block, assets_block)
        changed = True
else:
    # Insert after index directive
    i = txt.find("index index.html;")
    if i != -1:
        insert_at = i + len("index index.html;")
        txt = txt[:insert_at] + "\n" + assets_block + txt[insert_at:]
        changed = True

if changed:
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(txt)
    print("PATCHED")
else:
    print("ALREADY_OK")

