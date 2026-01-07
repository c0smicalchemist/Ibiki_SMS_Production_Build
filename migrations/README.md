# Database Migrations Guide

## Overview
This project uses SQL migration files to manage database schema changes. All migrations are tracked in a `migrations_history` table to ensure they're only run once.

## Migration Files Location
`migrations/` directory contains all migration SQL files:
- `0000_striped_leopardon.sql` - Initial schema
- `0002_multiple_phone_numbers.sql` - Phone number support
- `add-vendor-support.sql` - Vendor management
- `vendor-management.sql` - Extended vendor features
- `0003_add_vendor_credit_columns.sql` - **NEW** Vendor-specific credit columns

## Running Migrations

### Automatic Migration (Recommended)
Use the PowerShell migration runner:

```powershell
# Run all pending migrations
.\run-migrations.ps1

# Dry run (see what would be executed)
.\run-migrations.ps1 -DryRun

# Specify custom server
.\run-migrations.ps1 -Server 151.243.109.66
```

The script will:
1. Connect to your production server
2. Check which migrations have already run
3. Execute pending migrations in order
4. Track execution in `migrations_history` table
5. Automatically restart PM2 if successful

### Manual Migration
If you need to run a specific migration manually:

```bash
# SSH to server
ssh root@151.243.109.66

# Run migration
PGPASSWORD='your_password' psql -h localhost -U ibiki -d ibiki -f /path/to/migration.sql

# Record in history
PGPASSWORD='your_password' psql -h localhost -U ibiki -d ibiki -c "INSERT INTO migrations_history (migration_name, status) VALUES ('0003_add_vendor_credit_columns.sql', 'success')"
```

## Creating New Migrations

### Naming Convention
```
migrations/XXXX_descriptive_name.sql
```
- `XXXX` = Sequential number (0001, 0002, etc.)
- Use underscores for spaces
- Be descriptive but concise

### Migration Template
```sql
-- Migration: [Brief description]
-- Date: YYYY-MM-DD
-- Purpose: [Detailed explanation]

-- Use IF NOT EXISTS for idempotency
ALTER TABLE table_name 
ADD COLUMN IF NOT EXISTS column_name TYPE NOT NULL DEFAULT value;

-- Add indexes
CREATE INDEX IF NOT EXISTS index_name ON table_name(column_name);

-- Add comments for documentation
COMMENT ON COLUMN table_name.column_name IS 'Description';
```

### Best Practices
1. **Idempotent**: Use `IF NOT EXISTS` so migrations can be safely re-run
2. **Backwards Compatible**: Don't drop columns that might be in use
3. **Test First**: Run with `-DryRun` flag first
4. **Data Migration**: Include data transformation if needed
5. **Comments**: Add SQL comments explaining what and why

## Current Schema Columns

### users
- `id`, `email`, `password`, `name`, `company`
- `role` (admin | supervisor | client)
- `group_id` - ✅ For supervisor grouping
- `is_active`, `reset_token`, `reset_token_expiry`
- `created_at`

### client_profiles
- `id`, `user_id`
- `credits` - Legacy (deprecated)
- `credits_textbelt` - ✅ NEW: TextBelt-specific balance
- `credits_extremesms` - ✅ NEW: ExtremeSMS-specific balance
- `currency`, `custom_markup`
- `assigned_phone_numbers[]`
- `rate_limit_per_minute`, `business_name`
- `delivery_mode`, `webhook_url`, `webhook_secret`
- `updated_at`

## Troubleshooting

### "Column does not exist" Errors
If you see errors like:
```
column "credits_textbelt" does not exist
column "group_id" does not exist
```

**Solution**: Run the migrations!
```powershell
.\run-migrations.ps1
```

### Checking Migration Status
```bash
ssh root@151.243.109.66
PGPASSWORD='password' psql -h localhost -U ibiki -d ibiki -c "SELECT * FROM migrations_history ORDER BY executed_at DESC"
```

### Rollback (Manual)
If a migration causes issues:
1. Manually revert the schema changes
2. Update migrations_history:
```sql
UPDATE migrations_history 
SET status = 'rolled_back' 
WHERE migration_name = 'problematic_migration.sql';
```

### Re-running Failed Migration
```sql
DELETE FROM migrations_history 
WHERE migration_name = 'failed_migration.sql';
```
Then run `.\run-migrations.ps1` again.

## Integration with Deployment

The migration runner should be executed:
- **Before** deploying new code that depends on schema changes
- **After** restoring from backups
- **Whenever** you see "column does not exist" errors

### Deployment Workflow
```powershell
# 1. Pull latest code
git pull origin Prod_Live_Latest

# 2. Run migrations FIRST
.\run-migrations.ps1

# 3. Build application
npm run build

# 4. Deploy files
.\sync-deployment.ps1
```

## Monitoring

### Check PM2 Logs for Schema Errors
```bash
ssh root@151.243.109.66 "pm2 logs ibiki-sms --lines 50 --nostream | grep 'does not exist'"
```

### Verify Columns Exist
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'client_profiles'
AND column_name IN ('credits_textbelt', 'credits_extremesms')
ORDER BY column_name;
```

## Emergency Fix
If the site is down due to missing columns:

```powershell
# Quick fix: Run migrations
.\run-migrations.ps1

# If that fails, manual SQL:
ssh root@151.243.109.66
PGPASSWORD='password' psql -h localhost -U ibiki -d ibiki <<EOF
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS credits_textbelt NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS credits_extremesms NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id TEXT;
EOF

# Restart PM2
pm2 restart ibiki-sms
```

## Future Improvements
- [ ] Automated migration runner in CI/CD pipeline
- [ ] Migration validation (dry-run before production)
- [ ] Automated backups before migrations
- [ ] Schema version tracking in system_config table
- [ ] Rollback SQL for each migration
