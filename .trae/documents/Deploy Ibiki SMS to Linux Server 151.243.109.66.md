## Complete Deployment Plan for 151.243.109.66

### Phase 1: Server Preparation
1. SSH into 151.243.109.66 as root
2. Install PostgreSQL and create database/user
3. Set up application directory at /opt/ibiki

### Phase 2: Application Deployment
1. Copy application files from local to server
2. Install Node.js dependencies
3. Build the application
4. Configure environment variables

### Phase 3: Database Setup
1. Run database migrations
2. Set up PostgreSQL with proper user permissions
3. Configure database connection

### Phase 4: Service Configuration
1. Create systemd service for auto-start
2. Set up nginx reverse proxy (optional)
3. Configure firewall rules

### Phase 5: Testing & Verification
1. Start the application service
2. Test API endpoints
3. Verify database connectivity
4. Check application logs

### Commands to Execute:
- PostgreSQL setup: `CREATE DATABASE ibiki OWNER ibiki_user`
- Environment: Configure .env.production with proper credentials
- Service: Create systemd service for auto-restart
- Testing: Verify `/api/health` and `/api/test` endpoints work

This will deploy the full Ibiki SMS application with PostgreSQL backend on your Linux server.