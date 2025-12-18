## Complete Migration Plan: 151.243.109.79 → 151.243.109.66

### Overview
Migrate the entire working Ibiki SMS system from 151.243.109.79 to 151.243.109.66, including:
- PostgreSQL database with all data
- Complete application files and configuration
- Nginx web server configuration
- Systemd services for auto-startup
- Environment variables and secrets
- PM2 process management

### Migration Steps

#### 1. Backup Creation (151.243.109.79)
- **Database**: Full PostgreSQL backup (`ibiki-full-backup.sql`)
- **Application**: Complete application directory (`ibiki-app.tar.gz`)
- **Nginx**: Web server configuration (`nginx-config.tar.gz`)
- **Services**: Systemd service definitions (`systemd-services.tar.gz`)
- **Environment**: Production configuration (`ibiki-env.backup`)

#### 2. Transfer Process
- Secure copy all backup files via SCP
- Verify file integrity during transfer

#### 3. Restoration (151.243.109.66)
- Install required packages (PostgreSQL, Node.js, PM2, nginx)
- Create database and user
- Restore database from backup
- Restore application files
- Restore nginx configuration
- Restore systemd services
- Start all services

#### 4. Verification
- Test database connectivity
- Verify application startup
- Check nginx configuration
- Confirm service auto-start

### Files Provided
- `migrate-servers.sh` - Complete migration script
- `backup-source.sh` - Source server backup
- `restore-target.sh` - Target server restoration
- `full-backup-and-restore.sh` - Detailed migration

### Execution Commands
```bash
# From Windows PowerShell:
ssh root@151.243.109.79 "bash -s" < backup-source.sh
scp root@151.243.109.79:/tmp/ibiki-* root@151.243.109.66:/tmp/
ssh root@151.243.109.66 "bash -s" < restore-target.sh
```

### Expected Result
- **New Production URL**: http://151.243.109.66
- **Zero data loss**: Complete preservation of all data
- **Identical configuration**: Same as working server
- **Auto-start services**: Systemd and PM2 configured
- **Ready for production**: Fully functional deployment