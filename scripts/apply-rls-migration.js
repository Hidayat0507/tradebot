// Script to apply the RLS policies migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Supabase credentials from .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Read the migration file
const migrationPath = './supabase/migrations/20250217120000_add_bots_rls_policies.sql';
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Split the SQL into individual statements
const statements = migrationSQL
  .split(';')
  .map(statement => statement.trim())
  .filter(statement => statement.length > 0);

async function applyMigration() {
  console.log('Applying migration: Add RLS policies for bots and related tables');
  
  try {
    for (const statement of statements) {
      console.log(`Executing SQL statement:\n${statement.substring(0, 100)}...`);
      
      // Execute each SQL statement
      const { error } = await supabase.rpc('pgmeta_query', {
        query: statement + ';'
      });
      
      if (error) {
        throw error;
      }
      
      console.log('Statement executed successfully');
    }
    
    console.log('Migration applied successfully!');
  } catch (error) {
    console.error('Error applying migration:', error);
    
    // Try direct approach if RPC fails
    try {
      console.log('Attempting direct SQL execution...');
      const { error } = await supabase.rpc('pgmeta_ddl', {
        sql: migrationSQL
      });
      
      if (error) {
        throw error;
      }
      
      console.log('Migration applied successfully using direct SQL execution!');
    } catch (directError) {
      console.error('Direct SQL execution also failed:', directError);
      console.log('\nAlternative: You can apply this migration manually through the Supabase dashboard SQL editor.');
      console.log('The SQL file is located at: supabase/migrations/20250217120000_add_bots_rls_policies.sql');
      process.exit(1);
    }
  }
}

applyMigration();

