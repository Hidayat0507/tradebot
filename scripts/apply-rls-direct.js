// Direct script to apply RLS policies using REST API
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Read the migration file
const migrationSQL = fs.readFileSync('./supabase/migrations/20250217120000_add_bots_rls_policies.sql', 'utf8');

async function applyMigration() {
  console.log('Applying RLS policies migration...\n');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log('✅ Migration applied successfully!');
    console.log('\nYou can now create bots without RLS errors.');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.log('\n📝 Manual Alternative:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the contents of:');
    console.log('   supabase/migrations/20250217120000_add_bots_rls_policies.sql');
    console.log('4. Run the SQL\n');
  }
}

applyMigration();

