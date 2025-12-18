@echo off
echo Setting up PostgreSQL for Ibiki SMS Development...

REM Set PostgreSQL path
set PG_PATH="C:\Program Files\PostgreSQL\17\bin"

REM Create database and user
echo Creating database and user...
%PG_PATH%\psql -U postgres -c "CREATE USER ibiki_user WITH PASSWORD 'c0smic4382';"
%PG_PATH%\psql -U postgres -c "CREATE DATABASE ibiki OWNER ibiki_user;"
%PG_PATH%\psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ibiki TO ibiki_user;"

REM Test connection
echo Testing connection...
%PG_PATH%\psql -U ibiki_user -d ibiki -c "SELECT 'Database connection successful';"

echo PostgreSQL setup complete!
echo Database: ibiki
echo User: ibiki_user
echo Password: c0smic4382
echo.
echo Update your .env.development file with:
echo DATABASE_URL=postgresql://ibiki_user:c0smic4382@localhost:5432/ibiki
pause