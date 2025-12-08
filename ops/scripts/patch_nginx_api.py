import re
import sys

PATH = "/etc/nginx/sites-enabled/ibiki-sms"
with open(PATH, "r", encoding="utf-8") as f:
    txt = f.read()

start = txt.find("location /api/")
if start == -1:
    print("NO_API_BLOCK")
    sys.exit(0)

# find end of this location block
brace = txt.find("}", start)
block = txt[start:brace+1]

need = [
    "proxy_read_timeout",
    "send_timeout",
    "proxy_buffering",
    "proxy_request_buffering",
]
missing = [k for k in need if k not in block]
if missing:
    newblock = re.sub(
        r"(proxy_pass[^\n]*\n)",
        r"\1        proxy_read_timeout 75s\n        send_timeout 75s\n        proxy_buffering off\n        proxy_request_buffering off\n",
        block,
        count=1,
    )
    txt = txt[:start] + newblock + txt[brace+1:]
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(txt)
    print("PATCHED")
else:
    print("ALREADY_OK")

