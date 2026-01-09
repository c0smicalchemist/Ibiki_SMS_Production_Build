# SMS Vendor Configuration Guide

## Production Domain
**URL:** https://ibiki.run.place/

## Vendor Priority Configuration

### Primary Vendor: TextBelt
- **Status:** Primary SMS provider
- **Configuration Location:** Admin Dashboard → SMS Vendors → TextBelt
- **Required Settings:**
  - API Key: (Configure via dashboard after deployment)
  - API Endpoint: https://textbelt.com/text
  - Default: Set as active/primary vendor

### Fallback Vendor: ExtremeSMS
- **Status:** Alternative/Fallback provider
- **Configuration Location:** Admin Dashboard → SMS Vendors → ExtremeSMS
- **Required Settings:**
  - API Key: (Configure via dashboard after deployment)
  - API Endpoint: (Configure via dashboard)
  - Fallback: Enable as backup when TextBelt fails

## Post-Deployment Configuration Steps

1. **Access Admin Dashboard:**
   ```
   https://ibiki.run.place/
   Login: ibiki_dash@proton.me
   Password: Cosmic4382##
   ```

2. **Configure TextBelt (Primary):**
   - Navigate to: Admin Dashboard → SMS Vendor Management
   - Select TextBelt vendor
   - Enter API Key
   - Set Status: Active
   - Set Priority: Primary (1)
   - Test connection

3. **Configure ExtremeSMS (Fallback):**
   - Navigate to: Admin Dashboard → SMS Vendor Management
   - Select ExtremeSMS vendor
   - Enter API Key and credentials
   - Set Status: Active
   - Set Priority: Secondary (2)
   - Enable fallback mode
   - Test connection

4. **Verify Vendor Failover:**
   - Send test SMS via API
   - Simulate TextBelt failure (disable temporarily)
   - Verify automatic failover to ExtremeSMS
   - Re-enable TextBelt and verify primary restoration

## API Endpoints for Testing

### Send SMS (will use configured vendor priority)
```bash
curl -X POST https://ibiki.run.place/api/v2/sms/sendsingle \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Test message from Ibiki SMS"
  }'
```

### Check Vendor Status
```bash
curl -X GET https://ibiki.run.place/api/v2/vendors/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Vendor Pricing Configuration

Update pricing for both vendors in Admin Dashboard:
- **TextBelt:** Configure cost per SMS and client rate
- **ExtremeSMS:** Configure cost per SMS and client rate
- Ensure profit margins are set appropriately

## Important Notes

- Vendor API keys are NOT included in deployment for security
- Configure all vendor credentials via Admin Dashboard after deployment
- The multi-vendor system automatically switches to fallback on primary failure
- Monitor vendor performance in Admin Dashboard → Vendor Analytics
- Consider setting up webhook endpoints for delivery reports if vendors support them
