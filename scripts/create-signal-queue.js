// Simple script to create the signal_queue table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// SQL for creating signal_queue table
const createTableSQL = `
-- Create signal queue table (simplified version)
create table if not exists signal_queue (
  id text primary key,
  bot_id text not null,
  payload jsonb not null,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  result jsonb,
  error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  processing_started_at timestamp with time zone,
  completed_at timestamp with time zone,
  failed_at timestamp with time zone
);
`;

// SQL for creating indexes
const createIndexesSQL = `
-- Add indexes
create index if not exists signal_queue_bot_id_idx on signal_queue(bot_id);
create index if not exists signal_queue_status_idx on signal_queue(status);
create index if not exists signal_queue_created_at_idx on signal_queue(created_at);
`;

async function createTable() {
  try {
    console.log('Creating signal_queue table...');
    
    // Execute raw SQL query
    const { data, error } = await supabase.rpc('alter_table', { 
      table_name: 'signal_queue',
      sql_command: createTableSQL
    });
    
    if (error) {
      throw error;
    }
    
    console.log('Table created successfully!');
    
    // Now create indexes
    console.log('Creating indexes...');
    const { data: indexData, error: indexError } = await supabase.rpc('alter_table', { 
      table_name: 'signal_queue',
      sql_command: createIndexesSQL
    });
    
    if (indexError) {
      throw indexError;
    }
    
    console.log('Indexes created successfully!');
    console.log('All done!');
    
  } catch (error) {
    console.error('Error creating table:', error);
    
    // Try direct SQL method
    try {
      console.log('Trying direct SQL method...');
      
      // Use Supabase SQL function if available
      const { data, error } = await supabase.from('_exec_sql').select('*').eq('query', createTableSQL);
      
      if (error) {
        throw error;
      }
      
      console.log('Table created using direct SQL!');
    } catch (sqlError) {
      console.error('Direct SQL also failed:', sqlError);
    }
  }
}

createTable(); 