#!/bin/bash
# SSL Configuration Script for Ibiki SMS

# Create SSL configuration
cat > /etc/nginx/sites-available/ibiki-sms << 'EOF'
server {
    listen 80;
    server_name ibiki.run.place;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ibiki.run.place;

    ssl_certificate /etc/ssl/ibiki/cert.pem;
    ssl_certificate_key /etc/ssl/ibiki/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }
}
EOF

# Test and reload nginx
nginx -t && systemctl reload nginx