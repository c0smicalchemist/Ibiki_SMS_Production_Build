#!/bin/bash
# ONE COMMAND FIX - Adds Anveo to vendor_management JSON

PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki << 'EOSQL'
UPDATE system_config 
SET value = value::jsonb || '{"activeVendorId":"anveo","vendors":[{"id":"textbelt","name":"TextBelt","type":"textbelt","enabled":true,"priority":1,"timeout":10000,"retryAttempts":3,"retryDelay":1000,"config":{"apiKey":"a30321d80c30ac142e640dc2d1a2aa4c3dde81d8DhHW1zKrWnE4QZDyr1RQsH04t","baseUrl":"https://textbelt.com","maxRecipients":1,"rateLimit":75}},{"id":"extremesms","name":"ExtremeSMS","type":"extremesms","enabled":true,"priority":2,"timeout":10000,"retryAttempts":3,"retryDelay":1000,"config":{"apiKey":"","baseUrl":"https://extremesms.net","senderId":"","route":"4","unicode":false,"flash":false}},{"id":"anveo","name":"Anveo","type":"anveo","enabled":true,"priority":1,"timeout":10000,"retryAttempts":3,"retryDelay":1000,"config":{"apiKey":"e601cd693610f9a621d46e92e5ac3752fc865c55","baseUrl":"https://www.anveo.com/api/v1.asp","fromNumber":"+19144080890","rateLimit":60}}]}'::jsonb
WHERE key = 'vendor_management';
EOSQL

echo "Updated vendor_management - restarting PM2..."
pm2 restart ibiki-sms
sleep 5
pm2 logs ibiki-sms --lines 20 --nostream | head -40
