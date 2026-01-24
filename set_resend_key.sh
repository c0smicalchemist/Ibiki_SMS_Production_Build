#!/bin/bash
sudo -u postgres psql -d ibiki -c "INSERT INTO system_config (key, value) VALUES ('resend_api_key', 're_W8eQfCXh_D61dCqQPAHyShZ79d5jAvk9G') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"
sudo -u postgres psql -d ibiki -c "SELECT key,value FROM system_config WHERE key = 'resend_api_key';"
