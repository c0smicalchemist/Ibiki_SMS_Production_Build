// Temporary script to check vendor configuration
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query("SELECT value FROM system_config WHERE key='vendor_management'");
    const cfg = JSON.parse(result.rows[0]?.value || '{}');
    console.log('Active vendor:', cfg.activeVendorId);
    const tb = cfg.vendors?.find(v => v.id === 'textbelt');
    console.log('TextBelt config.apiKey raw value:', JSON.stringify(tb?.config?.apiKey));
    console.log('TextBelt state:', JSON.stringify(cfg.vendorStates?.textbelt, null, 2));
    console.log('env TEXTBELT_API_KEY:', process.env.TEXTBELT_API_KEY ? '***SET***' : 'NOT SET');
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
