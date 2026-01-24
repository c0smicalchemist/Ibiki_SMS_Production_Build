# API Key Linking Feature - Deployment Summary

**Date:** January 22, 2025  
**Feature:** Link phone numbers to specific Anveo API keys in Number Pool management

## Changes Made

### Database Changes
- ✅ Added `api_key_id` column to `anveo_numbers` table
- ✅ Created index on `api_key_id` for performance
- ✅ Migration executed successfully on production database

### Frontend Changes (client/src/components/NumberPoolManager.tsx)
- ✅ Added `api_key_id` field to `AnveoNumber` interface
- ✅ Added `ApiKey` interface for type safety
- ✅ Implemented API key fetching from `/api/admin/api-pool/keys`
- ✅ Added API key selector dropdown to "Add Number" dialog
- ✅ Added API key selector dropdown to "Edit Number" dialog
- ✅ Added "API Key" column to number pool table
- ✅ Display linked API key name or "Not linked" for each number

### Backend Changes (server/routes.ts)
- ✅ Updated `POST /api/admin/number-pool` to accept and store `api_key_id`
- ✅ Updated `PATCH /api/admin/number-pool/:id` to allow updating `api_key_id`
- ✅ Modified SQL queries to include api_key_id field

## Current Number Pool Status

All 4 numbers currently have no API key linked (api_key_id is NULL):
- +17204398855 (active, 1500/day limit)
- +19144080890 (warming, 100/day limit)
- +19144080870 (warming, 100/day limit)
- +19046409006 (warming, 100/day limit)

## How to Use

### Link a Number to an API Key:
1. Go to Admin Dashboard → Number Pool tab
2. Click "Edit" on any number
3. Select an Anveo API key from the dropdown
4. Click "Update"

### Add a New Number with API Key:
1. Click "+ Add Number"
2. Fill in phone number, worker URL, status, and daily limit
3. Select an Anveo API key from the dropdown (optional)
4. Click "Add Number"

## API Key Selection
- Only **active Anveo API keys** are shown in the dropdown
- The dropdown displays: `{key.name} ({key.fromNumber})`
- Example: "Anveo NY #1 (+19144080890)"

## Database Schema

```sql
ALTER TABLE anveo_numbers 
ADD COLUMN api_key_id VARCHAR(255);

COMMENT ON COLUMN anveo_numbers.api_key_id IS 
  'Links to api_key_pool.id - which Anveo API key this number uses';

CREATE INDEX idx_anveo_numbers_api_key_id ON anveo_numbers(api_key_id);
```

## Future Enhancements
- [ ] Auto-suggest matching API key based on phone number
- [ ] Validation: ensure selected API key matches worker assignment
- [ ] Bulk API key assignment for multiple numbers
- [ ] Use api_key_id in NumberPoolManager.selectNumber() for routing

## Deployment Details

**Build:** Completed successfully (59ms backend, 4.75s frontend)  
**Archive:** deploy-api-key-linking.tar.gz (61MB)  
**Deployed:** /opt/ibiki-sms on 151.243.109.66  
**PM2 Status:** ibiki-sms restarted, 2 instances online  

**Migration File:** migrations/add_api_key_to_numbers.sql  
**Execution:** sudo -u postgres psql -d ibiki -f /tmp/add_api_key_to_numbers.sql

## Verification

Check the Number Pool tab in the admin console:
- You should see a new "API Key" column
- When adding/editing numbers, you should see an "Anveo API Key" dropdown
- The dropdown should show all active Anveo API keys

## Troubleshooting

**Issue:** API Key dropdown is empty  
**Solution:** Ensure you have active Anveo API keys in the API Keys tab

**Issue:** Changes not reflecting  
**Solution:** Hard refresh the browser (Ctrl+Shift+R) to clear cache

**Issue:** Number shows "Not linked"  
**Solution:** This is expected for existing numbers - edit them to assign an API key
