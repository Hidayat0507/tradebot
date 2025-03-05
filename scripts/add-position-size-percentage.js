const { createClient } = require('@supabase/supabase-js');

// Configuration from .env.local
const SUPABASE_URL = 'https://kcycnhofgmunwlndqlqb.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeWNuaG9mZ211bndsbmRxbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA2MzM3NCwiZXhwIjoyMDUxNjM5Mzc0fQ.lkcfXhq6hkan7J6dYloT8FbKA4NBvK_YV5815V2dCBE';

async function addPositionSizePercentage() {
  try {
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Execute raw SQL to add the column
    const { data, error } = await supabase.rpc('add_position_size_percentage_column');
    
    if (error) {
      console.error('Error adding position_size_percentage column:', error);
      
      // Try alternative approach with direct SQL
      console.log('Trying alternative approach with direct SQL...');
      
      // Create a stored procedure to add the column
      const { error: createProcError } = await supabase.rpc('execute_sql', {
        sql: `
          CREATE OR REPLACE FUNCTION public.add_position_size_percentage_column()
          RETURNS void AS $$
          BEGIN
            -- Add the column if it doesn't exist
            IF NOT EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'bots' 
              AND column_name = 'position_size_percentage'
            ) THEN
              ALTER TABLE public.bots ADD COLUMN position_size_percentage INTEGER;
            END IF;
          END;
          $$ LANGUAGE plpgsql;
        `
      });
      
      if (createProcError) {
        console.error('Error creating stored procedure:', createProcError);
        
        // Try direct SQL execution
        console.log('Trying direct SQL execution...');
        
        // Execute SQL directly
        const { error: directSqlError } = await supabase.rpc('execute_sql', {
          sql: `ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS position_size_percentage INTEGER;`
        });
        
        if (directSqlError) {
          console.error('Error executing direct SQL:', directSqlError);
          return;
        }
        
        console.log('Successfully added position_size_percentage column using direct SQL');
      } else {
        // Execute the stored procedure
        const { error: execProcError } = await supabase.rpc('add_position_size_percentage_column');
        
        if (execProcError) {
          console.error('Error executing stored procedure:', execProcError);
          return;
        }
        
        console.log('Successfully added position_size_percentage column using stored procedure');
      }
    } else {
      console.log('Successfully added position_size_percentage column');
    }
    
    // Update the bot with position_size_percentage
    const { data: updatedBot, error: updateError } = await supabase
      .from('bots')
      .update({ position_size_percentage: 50 })
      .eq('id', '1F3D1863')
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating bot with position_size_percentage:', updateError);
      return;
    }
    
    console.log('Updated bot with position_size_percentage:', updatedBot);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

addPositionSizePercentage().catch(console.error); 