# 📊 Data Import Guide for Ibiki SMS

## ✅ **DATABASE READY FOR IMPORT**

### 🔗 **Connection Details:**
```
Host: 151.243.109.66
Database: ibiki
User: ibiki_user
Password: c0smic4382
Port: 5432
Connection String: postgresql://ibiki_user:c0smic4382@localhost:5432/ibiki
```

## 📥 **Data Import Commands**

### **Method 1: SQL File Import**
```bash
# Import from SQL file
ssh root@151.243.109.66 "psql -U ibiki_user -d ibiki < your-backup.sql"

# Import from local file
scp your-backup.sql root@151.243.109.66:/tmp/
ssh root@151.243.109.66 "psql -U ibiki_user -d ibiki < /tmp/your-backup.sql"
```

### **Method 2: Custom Format Import**
```bash
# Import from custom format backup
ssh root@151.243.109.66 "pg_restore -U ibiki_user -d ibiki your-backup.dump"

# Import with specific options
ssh root@151.243.109.66 "pg_restore -U ibiki_user -d ibiki --clean --create your-backup.dump"
```

### **Method 3: CSV Import**
```bash
# Import CSV files
ssh root@151.243.109.66 "psql -U ibiki_user -d ibiki -c \"COPY users FROM '/tmp/users.csv' CSV HEADER;\""
```

## 🎯 **Quick Import Commands**

### **For SQL Backup:**
```bash
# Upload your backup
scp your-backup.sql root@151.243.109.66:/tmp/

# Import data
ssh root@151.243.109.66 "psql -U ibiki_user -d ibiki -f /tmp/your-backup.sql"

# Verify import
ssh root@151.243.109.66 "psql -U ibiki_user -d ibiki -c 'SELECT COUNT(*) FROM users;'"
```

### **For PostgreSQL Dump:**
```bash
# Upload dump file
scp your-backup.dump root@151.243.109.66:/tmp/

# Import dump
ssh root@151.243.109.66 "pg_restore -U ibiki_user -d ibiki /tmp/your-backup.dump"

# Check data
ssh root@151.243.109.66 "psql -U ibiki_user -d ibiki -c 'SELECT * FROM users LIMIT 5;'"
```

## 📋 **Current Database Status:**
- ✅ PostgreSQL running
- ✅ Database `ibiki` ready
- ✅ User `ibiki_user` configured
- ✅ Application restarted and responding
- ✅ Ready for data import

## 🚀 **Ready to Import Your Data!**

Simply run one of the above commands with your backup file to complete the data import.