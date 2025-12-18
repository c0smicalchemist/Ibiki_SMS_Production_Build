# PostgreSQL Setup Guide for Ibiki SMS Development

## Step 1: Set PostgreSQL Password

During PostgreSQL installation, you need to set a password for the `postgres` user. If you haven't set it yet:

1. Open pgAdmin 4 (should be installed with PostgreSQL)
2. Connect to the PostgreSQL server
3. Set a password for the `postgres` user

## Step 2: Create Database and User

Run these commands in PowerShell (replace `YOUR_PASSWORD` with your actual PostgreSQL password):

```powershell
# Set PostgreSQL path
$env:PGPASSWORD = "YOUR_PASSWORD"
$pgPath = "C:\Program Files\PostgreSQL\17\bin"

# Create database
& "$pgPath\createdb.exe" -U postgres ibiki

# Create user with password
& "$pgPath\psql.exe" -U postgres -c "CREATE USER ibiki_user WITH PASSWORD 'c0smic4382';"
& "$pgPath\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ibiki TO ibiki_user;"

# Test connection
& "$pgPath\psql.exe" -U ibiki_user -d ibiki -c "SELECT 'Connection successful';"
```

## Step 3: Update Environment Configuration

Update your `.env.development` file:

```bash
# Development Environment Configuration
NODE_ENV=development
PORT=3000

# Database - PostgreSQL for development
DATABASE_URL=postgresql://ibiki_user:c0smic4382@localhost:5432/ibiki

# Session & JWT Secrets
SESSION_SECRET=dev-session-secret-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production

# Email Service (Optional for development)
RESEND_API_KEY=

# SMS Service (Optional for development)
EXTREMESMS_API_KEY=
EXTREMESMS_SENDER_ID=

# Development specific settings
DEBUG=true
LOG_LEVEL=debug
```

## Step 4: Alternative Quick Setup

If you want to use the default postgres user for development:

1. Update `.env.development`:
```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ibiki
```

2. Create the database:
```powershell
$env:PGPASSWORD = "YOUR_PASSWORD"
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres ibiki
```

## Step 5: Start the Application

After setting up the database:

```bash
npm run dev
```

## Troubleshooting

If you get authentication errors:
1. Check PostgreSQL service is running: `Get-Service postgresql*`
2. Verify PostgreSQL is listening on port 5432
3. Check pg_hba.conf file for authentication settings
4. Use pgAdmin 4 to manage users and databases

## Default PostgreSQL Credentials

- **Host**: localhost
- **Port**: 5432
- **Default User**: postgres
- **Default Database**: postgres

Use pgAdmin 4 (installed with PostgreSQL) for GUI management.