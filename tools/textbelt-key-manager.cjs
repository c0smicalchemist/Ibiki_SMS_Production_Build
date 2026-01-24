#!/usr/bin/env node
/**
 * TextBelt API Key Manager
 * 
 * Script to manage multiple TextBelt API keys for scaling to high volumes.
 * 
 * Features:
 * - Add new keys to the database
 * - Check credit balance for all keys
 * - Bulk recharge (opens browser to purchase page with key pre-filled)
 * - List all keys with status
 * 
 * Usage:
 *   node textbelt-key-manager.js list              - List all keys with credits
 *   node textbelt-key-manager.js add <key> <name>  - Add a new key
 *   node textbelt-key-manager.js check             - Check credits for all keys
 *   node textbelt-key-manager.js recharge          - Open recharge pages for low keys
 *   node textbelt-key-manager.js recharge-all      - Open recharge pages for ALL keys
 */

const https = require('https');
const { exec } = require('child_process');

// Database connection (uses environment variable or default)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ibiki';

// Parse database URL
function parseDbUrl(url) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error('Invalid DATABASE_URL format');
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5]
  };
}

// Check TextBelt API key quota
async function checkQuota(apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'textbelt.com',
      path: '/quota/' + apiKey,
      method: 'GET',
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ success: true, quota: json.quotaRemaining, data: json });
        } catch (e) {
          resolve({ success: false, error: 'Invalid response', raw: data });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
    req.end();
  });
}

// Run psql command
function runPsql(sql) {
  return new Promise((resolve, reject) => {
    const db = parseDbUrl(DATABASE_URL);
    const env = { ...process.env, PGPASSWORD: db.password };
    const cmd = `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -t -c "${sql.replace(/"/g, '\\"')}"`;
    
    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// Get all keys from database
async function getAllKeys() {
  const result = await runPsql(`
    SELECT id, name, api_key, quota_limit, quota_used, is_active, priority
    FROM vendor_api_key_pool 
    WHERE vendor = 'textbelt'
    ORDER BY priority, name
  `);
  
  if (!result) return [];
  
  return result.split('\n').filter(line => line.trim()).map(line => {
    const [id, name, apiKey, quotaLimit, quotaUsed, isActive, priority] = line.split('|').map(s => s.trim());
    return {
      id,
      name,
      apiKey,
      quotaLimit: parseInt(quotaLimit) || 0,
      quotaUsed: parseInt(quotaUsed) || 0,
      isActive: isActive === 't',
      priority: parseInt(priority) || 0
    };
  });
}

// Add a new key
async function addKey(apiKey, name, priority = 0) {
  // Check quota first
  const quota = await checkQuota(apiKey);
  if (!quota.success) {
    console.error('⚠️  Warning: Could not verify API key quota:', quota.error);
  }
  
  const sql = `
    INSERT INTO vendor_api_key_pool (vendor, name, api_key, is_active, priority, quota_limit)
    VALUES ('textbelt', '${name.replace(/'/g, "''")}', '${apiKey}', true, ${priority}, ${quota.quota || 0})
    RETURNING id, name;
  `;
  
  const result = await runPsql(sql);
  return result;
}

// Update quota in database
async function updateQuota(id, quota) {
  const sql = `UPDATE vendor_api_key_pool SET quota_limit = ${quota}, updated_at = NOW() WHERE id = '${id}'`;
  await runPsql(sql);
}

// Open browser to TextBelt purchase page
function openRechargeUrl(apiKey) {
  const url = `https://textbelt.com/purchase/?key=${encodeURIComponent(apiKey)}`;
  
  // Cross-platform browser open
  const cmd = process.platform === 'win32' 
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  
  exec(cmd, (err) => {
    if (err) console.error('Failed to open browser:', err.message);
  });
  
  return url;
}

// Main commands
async function listKeys() {
  console.log('\n📋 TextBelt API Keys\n');
  console.log('─'.repeat(100));
  console.log('Priority | Status | Name                          | Credits | API Key (last 8)');
  console.log('─'.repeat(100));
  
  const keys = await getAllKeys();
  
  for (const key of keys) {
    const status = key.isActive ? '✅ Active' : '❌ Inactive';
    const keyShort = '...' + key.apiKey.slice(-8);
    console.log(
      `   ${key.priority}     | ${status.padEnd(10)} | ${key.name.padEnd(30)} | ${String(key.quotaLimit).padStart(7)} | ${keyShort}`
    );
  }
  
  console.log('─'.repeat(100));
  console.log(`Total: ${keys.length} keys, ${keys.reduce((sum, k) => sum + k.quotaLimit, 0)} credits\n`);
}

async function checkAllKeys() {
  console.log('\n🔍 Checking TextBelt API Key Credits...\n');
  
  const keys = await getAllKeys();
  let totalCredits = 0;
  let lowKeys = [];
  
  for (const key of keys) {
    process.stdout.write(`  Checking ${key.name}... `);
    const result = await checkQuota(key.apiKey);
    
    if (result.success) {
      totalCredits += result.quota;
      console.log(`✅ ${result.quota} credits`);
      
      // Update database with actual quota
      await updateQuota(key.id, result.quota);
      
      if (result.quota < 100) {
        lowKeys.push({ ...key, quota: result.quota });
      }
    } else {
      console.log(`❌ Error: ${result.error}`);
    }
  }
  
  console.log('\n' + '─'.repeat(50));
  console.log(`📊 Total credits across all keys: ${totalCredits}`);
  console.log(`📈 Daily capacity at 2 SMS/sec: ${keys.length * 172800} SMS/day`);
  
  if (lowKeys.length > 0) {
    console.log(`\n⚠️  ${lowKeys.length} keys have low credits (<100):`);
    lowKeys.forEach(k => console.log(`   - ${k.name}: ${k.quota} credits`));
  }
  
  console.log('');
}

async function rechargeKeys(rechargeAll = false) {
  const keys = await getAllKeys();
  const threshold = rechargeAll ? Infinity : 500;
  
  console.log('\n💳 Opening TextBelt Purchase Pages...\n');
  
  let count = 0;
  for (const key of keys) {
    // Check current quota
    const result = await checkQuota(key.apiKey);
    const credits = result.success ? result.quota : key.quotaLimit;
    
    if (rechargeAll || credits < threshold) {
      console.log(`  Opening recharge for: ${key.name} (${credits} credits)`);
      openRechargeUrl(key.apiKey);
      count++;
      
      // Wait a bit between opening tabs to avoid browser issues
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  if (count === 0) {
    console.log('  ✅ All keys have sufficient credits (>500)');
  } else {
    console.log(`\n  Opened ${count} purchase page(s) in browser`);
    console.log('  💡 Tip: Select "$45/3500 texts" for best value\n');
  }
}

async function addNewKey(apiKey, name) {
  if (!apiKey || !name) {
    console.error('Usage: node textbelt-key-manager.js add <api-key> <friendly-name>');
    console.error('Example: node textbelt-key-manager.js add abc123xyz456 "TextBelt Key 3"');
    process.exit(1);
  }
  
  console.log(`\n➕ Adding new TextBelt key: ${name}`);
  
  try {
    const result = await addKey(apiKey, name);
    console.log('✅ Key added successfully!');
    console.log('   ', result);
  } catch (e) {
    console.error('❌ Failed to add key:', e.message);
  }
}

// Bulk add keys from file
async function bulkAddKeys(filename) {
  const fs = require('fs');
  
  if (!filename) {
    console.log('\n📝 Bulk Add Keys');
    console.log('────────────────');
    console.log('Create a file with one key per line in format:');
    console.log('  <api_key>,<friendly_name>,<priority>');
    console.log('\nExample keys.txt:');
    console.log('  abc123xyz456,TextBelt Key 3,0');
    console.log('  def789abc012,TextBelt Key 4,0');
    console.log('  ghi345jkl678,Backup Key 1,1');
    console.log('\nThen run:');
    console.log('  node textbelt-key-manager.js bulk-add keys.txt\n');
    return;
  }
  
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  
  console.log(`\n📥 Bulk adding ${lines.length} keys from ${filename}...\n`);
  
  for (const line of lines) {
    const [apiKey, name, priority] = line.split(',').map(s => s.trim());
    if (apiKey && name) {
      try {
        await addKey(apiKey, name, parseInt(priority) || 0);
        console.log(`  ✅ Added: ${name}`);
      } catch (e) {
        console.log(`  ❌ Failed: ${name} - ${e.message}`);
      }
    }
  }
  
  console.log('\nDone!\n');
}

// CLI
async function main() {
  const [,, command, ...args] = process.argv;
  
  try {
    switch (command) {
      case 'list':
        await listKeys();
        break;
        
      case 'check':
        await checkAllKeys();
        break;
        
      case 'add':
        await addNewKey(args[0], args.slice(1).join(' ') || args[0]);
        break;
        
      case 'bulk-add':
        await bulkAddKeys(args[0]);
        break;
        
      case 'recharge':
        await rechargeKeys(false);
        break;
        
      case 'recharge-all':
        await rechargeKeys(true);
        break;
        
      default:
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           TextBelt API Key Manager for Ibiki SMS              ║
╠═══════════════════════════════════════════════════════════════╣
║  Commands:                                                    ║
║    list          - List all keys with current credits         ║
║    check         - Check & update credits from TextBelt API   ║
║    add <key> <name> - Add a new API key                       ║
║    bulk-add <file>  - Add multiple keys from a file           ║
║    recharge      - Open purchase page for LOW credit keys     ║
║    recharge-all  - Open purchase page for ALL keys            ║
╠═══════════════════════════════════════════════════════════════╣
║  Scaling Tips:                                                ║
║    • Use 20 active keys + 5 backup keys for 200k/day          ║
║    • Best value: $45/3500 texts package                       ║
║    • Keys with priority 0 are used first, then priority 1     ║
╚═══════════════════════════════════════════════════════════════╝
`);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
