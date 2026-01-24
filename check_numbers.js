import { config } from 'dotenv';
import { Client } from 'pg';

// Load environment variables
config();

async function createTable() {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://ibiki_user:c0smic4382@localhost:5432/ibiki';

  console.log('Connecting to database...');
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    await client.connect();
    console.log('Connected successfully');

    // Create the anveo_numbers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS anveo_numbers (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        vendor_account_id INTEGER,
        worker_url VARCHAR(255),
        status VARCHAR(20) DEFAULT 'active',
        daily_limit INTEGER DEFAULT 100,
        sent_today INTEGER DEFAULT 0,
        complaints INTEGER DEFAULT 0,
        error_count_today INTEGER DEFAULT 0,
        success_count_today INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        warming_day INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        last_reset_date DATE DEFAULT CURRENT_DATE,
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);

    console.log('Table created successfully');

    // Insert a test number
    await client.query(`
      INSERT INTO anveo_numbers (phone_number, status, daily_limit, sent_today, worker_url)
      VALUES ('+1234567890', 'active', 100, 0, 'https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook')
      ON CONFLICT (phone_number) DO NOTHING
    `);

    console.log('Test number inserted');

    // Check the data
    const result = await client.query('SELECT * FROM anveo_numbers');
    console.log('Numbers in table:', result.rows.length);
    result.rows.forEach(row => {
      console.log(`${row.phone_number}: ${row.status}, ${row.sent_today}/${row.daily_limit}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

createTable();