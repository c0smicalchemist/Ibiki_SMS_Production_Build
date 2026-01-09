#!/bin/bash
# Check incoming messages
export PGPASSWORD='c0smic4382'
echo "Recent Incoming Messages:"
psql -h localhost -U ibiki_user -d ibiki << 'SQL'
SELECT id, "from", receiver, LEFT(message, 40) as msg, status, created_at 
FROM incoming_messages 
ORDER BY created_at DESC 
LIMIT 5;
SQL
