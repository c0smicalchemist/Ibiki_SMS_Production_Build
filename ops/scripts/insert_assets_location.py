import re
import sys

PATH = "/etc/nginx/sites-enabled/ibiki-sms"
with open(PATH, "r", encoding="utf-8") as f:
    txt = f.read()

if "location /assets/" in txt:
    print("ALREADY_HAS_ASSETS")
    sys.exit(0)

# insert assets location after server root/index lines
pattern = r"(index index\.html;\n)"
assets_block = (
    "    location /assets/ {\n"
    "        add_header Cache-Control \"no-store, must-revalidate\" always;\n"
    "        try_files $uri =404;\n"
    "    }\n\n"
)
new = re.sub(pattern, r"\1" + assets_block, txt, count=1)
if new != txt:
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(new)
    print("INSERTED_ASSETS")
else:
    print("NO_MATCH")

