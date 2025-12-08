path = "/etc/nginx/sites-enabled/ibiki-sms"
with open(path, "r", encoding="utf-8") as f:
    txt = f.read()

txt = txt.replace("proxy_read_timeout 75s\n", "proxy_read_timeout 75s;\n")
txt = txt.replace("send_timeout 75s\n", "send_timeout 75s;\n")
txt = txt.replace("proxy_buffering off\n", "proxy_buffering off;\n")
txt = txt.replace("proxy_request_buffering off\n", "proxy_request_buffering off;\n")

with open(path, "w", encoding="utf-8") as f:
    f.write(txt)
print("FIXED")
