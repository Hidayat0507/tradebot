const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const migrations = [
  '20250228_add_bitget_password.sql',
  '20250228_add_pair_normalization_and_trade_index.sql',
  '20250301_update_exchange_check.sql',
];

async function runSql(sql) {
  // Try running statement-by-statement via pgmeta_query first
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    const query = statement.endsWith(';') ? statement : statement + ';';
    const { error } = await supabase.rpc('pgmeta_query', { query });
    if (error) {
      throw error;
    }
  }
}

async function runSqlFallback(sql) {
  const { error } = await supabase.rpc('pgmeta_ddl', { sql });
  if (error) throw error;
}

async function apply() {
  try {
    for (const file of migrations) {
      const migrationPath = path.resolve(process.cwd(), 'supabase', 'migrations', file);
      console.log(`Applying migration: ${file}`);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      try {
        await runSql(sql);
        console.log(`✓ Applied ${file} via pgmeta_query`);
      } catch (e1) {
        console.warn(`pgmeta_query failed for ${file}:`, e1.message);
        console.log('Falling back to pgmeta_ddl...');
        try {
          await runSqlFallback(sql);
          console.log(`✓ Applied ${file} via pgmeta_ddl`);
        } catch (e2) {
          console.error(`✗ Failed to apply ${file}:`, e2.message);
          process.exit(1);
        }
      }
    }
    console.log('All migrations applied successfully');
  } catch (err) {
    console.error('Migration run failed:', err);
    process.exit(1);
  }
}

apply();







