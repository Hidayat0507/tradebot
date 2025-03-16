// Auto-process pending webhook signals
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function processPendingSignals() {
  try {
    console.log('Checking for pending signals...');
    
    // Get all pending signals
    const { data: pendingSignals, error } = await supabase
      .from('signal_queue')
      .select('id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10); // Process 10 at a time
    
    if (error) {
      throw error;
    }
    
    if (!pendingSignals || pendingSignals.length === 0) {
      console.log('No pending signals found.');
      return;
    }
    
    console.log(`Found ${pendingSignals.length} pending signals. Processing...`);
    
    // Process each signal
    for (const signal of pendingSignals) {
      console.log(`Processing signal: ${signal.id}`);
      
      try {
        // Call the process endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ signal_id: signal.id }),
        });
        
        const result = await response.json();
        console.log(`Signal ${signal.id} processing result:`, result);
      } catch (processError) {
        console.error(`Error processing signal ${signal.id}:`, processError);
      }
    }
    
    console.log('Finished processing signals.');
  } catch (error) {
    console.error('Error auto-processing signals:', error);
  }
}

// Run immediately
processPendingSignals();

// To use this script with a scheduler:
// 1. AWS Lambda: Schedule with EventBridge
// 2. Vercel Cron Jobs: Create a serverless function and schedule it
// 3. Node.js server: Use node-cron to schedule periodic execution

module.exports = { processPendingSignals }; 