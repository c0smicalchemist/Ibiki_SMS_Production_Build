# API Key Fixes - Deployment Summary

**Date:** January 23, 2026  
**Issue:** API Keys tab showing phone numbers, Number Pool unable to fetch API keys

## Problems Fixed

### 1. Phone Numbers Showing in API Keys Tab ✅
**Issue:** The "Key / Number" column was displaying phone numbers (+19144080890, +19144080870, +19046409006) in the API Keys tab.

**Root Cause:** Lines 705-709 in ApiKeyPoolManager.tsx were rendering `key.fromNumber` when it existed.

**Fix:** 
- Removed the phone number display logic from the API key table cell
- Changed table header from "Key / Number" to "API Key"
- Phone numbers are now ONLY managed in the Number Pool tab

### 2. Number Pool Can't Find API Keys ✅
**Issue:** The "Anveo API Key" dropdown in Number Pool showed "No active Anveo API keys" even though API keys existed.

**Root Cause:** NumberPoolManager was fetching from wrong endpoint `/api/admin/api-pool/keys` which doesn't exist.

**Fix:** Updated to fetch from correct endpoint `/api/admin/api-key-pool?showKeys=true`

## Changes Made

### Frontend Changes

**File: client/src/components/NumberPoolManager.tsx**
```typescript
// BEFORE (Wrong endpoint)
queryKey: ['/api/admin/api-pool/keys'],
queryFn: async () => {
  const res = await apiRequest('/api/admin/api-pool/keys');
  return res as { keys: ApiKey[] };
}

// AFTER (Correct endpoint)
queryKey: ['/api/admin/api-key-pool'],
queryFn: async () => {
  const res = await apiRequest('/api/admin/api-key-pool?showKeys=true');
  return res as { success: boolean; keys: ApiKey[] };
}
```

**File: client/src/components/ApiKeyPoolManager.tsx**
- **Line 645:** Changed header from `<TableHead>Key / Number</TableHead>` to `<TableHead>API Key</TableHead>`
- **Lines 668-709:** Removed `flex-col` wrapper and phone number display logic
- **Result:** API keys table now shows ONLY API key information, no phone numbers

## Expected Behavior After Fix

### API Keys Tab:
- ✅ Shows vendor API keys (Name, Vendor, API Key, Status, Quota, etc.)
- ✅ NO phone numbers displayed
- ✅ "From Number" field in "Add API Key" dialog is for internal Anveo configuration (optional)

### Number Pool Tab:
- ✅ Shows phone numbers with all details
- ✅ "Anveo API Key" dropdown now populates with available keys:
  - "Anveo NY #1 (+19144080890)"
  - "Anveo NY #2 (+19144080870)"
  - "Anveo FL #3 (+19046409006)"
- ✅ Can link each phone number to a specific API key
- ✅ Table shows which API key each number is linked to

## How to Verify

1. **Hard refresh your browser** (Ctrl+Shift+R or Cmd+Shift+R)
2. Go to Admin Dashboard
3. Check **API Keys tab:**
   - Should show 3 API keys (Anveo NY #1, NY #2, FL #3)
   - Should NOT show phone numbers in the table
   - "API Key" column shows masked keys (****5c55)
4. Check **Number Pool tab:**
   - Should show 4 phone numbers
   - Click "Edit" on any number
   - "Anveo API Key" dropdown should show 3 options
   - Select an API key and save

## Clean Data Separation

### API Keys Tab (Vendor Credentials)
- Purpose: Manage vendor API credentials for sending SMS
- Shows: API key name, vendor, credentials, status, quotas
- Use case: Add/remove vendor accounts, monitor API usage

### Number Pool Tab (Phone Numbers)
- Purpose: Manage phone numbers for SMS routing
- Shows: Phone numbers, status, daily limits, worker assignment, linked API key
- Use case: Add/remove numbers, assign to workers, link to API keys

## Next Steps

You can now:
1. Edit existing numbers to assign them to API keys
2. When adding new numbers, select which API key they should use
3. Keep API keys and phone numbers cleanly separated

## Deployment Details

**Build Time:** 4.50s frontend, 28ms backend  
**Archive:** deploy-fix-api-keys.tar.gz (62MB)  
**Deployed:** /opt/ibiki-sms on 151.243.109.66  
**PM2 Status:** Restarted successfully, 2 instances online  
**Restart Count:** 34 (normal operation)
