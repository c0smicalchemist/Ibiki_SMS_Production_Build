#!/bin/bash
cd /opt/ibiki-sms
source .env
psql $DATABASE_URL -c "SELECT response_payload FROM message_logs WHERE message_id = 'bulk_1767990608634';"
