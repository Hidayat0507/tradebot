require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  console.log('Checking available bots in Supabase...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables in .env.local');
    process.exit(1);
  }
  
  try {
    // Create Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Query the bots table
    const { data: bots, error } = await supabase
      .from('bots')
      .select('id, name, exchange, webhook_secret')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }
    
    if (!bots || bots.length === 0) {
      console.log('No bots found in the database.');
      return;
    }
    
    console.log(`Found ${bots.length} bots:`);
    bots.forEach((bot, index) => {
      console.log(`\nBot #${index + 1}:`);
      console.log(`  ID: ${bot.id}`);
      console.log(`  Name: ${bot.name}`);
      console.log(`  Exchange: ${bot.exchange}`);
      console.log(`  Webhook Secret: ${bot.webhook_secret ? bot.webhook_secret.substring(0, 8) + '...' : 'Not set'}`);
      
      // Generate a curl command for this bot
      const webhookCommand = `curl -X POST "http://localhost:3000/api/webhook" -H "Content-Type: application/json" -d '{"bot_id": "${bot.id}", "symbol": "UBTC/USDC", "action": "BUY", "secret": "${bot.webhook_secret}"}'`;
      
      console.log('\nTest command:');
      console.log(webhookCommand);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error); 