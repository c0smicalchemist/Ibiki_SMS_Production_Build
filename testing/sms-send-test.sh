#!/bin/bash
# SMS Send Test Script
# This script tests the full SMS send flow

echo '=== SMS Send Test ==='

# Test sending via TextBelt (uses quota - only run when needed)
# Using the TextBelt API key directly

TEXTBELT_KEY="a30321d80c30ac142e640dc2d1a2aa4c3dde81d8DhHW1zKrWnE4QZDyr1RQsH04t"
TEST_PHONE="+14012885277"
TEST_MESSAGE="Ibiki SMS Test - $(date '+%Y-%m-%d %H:%M:%S')"

echo "Phone: $TEST_PHONE"
echo "Message: $TEST_MESSAGE"
echo ""

# Check quota before
echo "1. Quota before send:"
curl -s "https://textbelt.com/quota/$TEXTBELT_KEY" | jq .

echo ""
echo "2. Sending test SMS via TextBelt..."
RESULT=$(curl -s -X POST https://textbelt.com/text \
  --data-urlencode "phone=$TEST_PHONE" \
  --data-urlencode "message=$TEST_MESSAGE" \
  --data-urlencode "key=$TEXTBELT_KEY")
echo "Result: $RESULT"

echo ""
echo "3. Quota after send:"
curl -s "https://textbelt.com/quota/$TEXTBELT_KEY" | jq .

echo ""
echo "=== SMS Send Test Complete ==="
