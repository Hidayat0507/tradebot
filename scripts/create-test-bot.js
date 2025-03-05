const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Configuration from .env.local
const SUPABASE_URL = 'https://kcycnhofgmunwlndqlqb.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeWNuaG9mZ211bndsbmRxbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA2MzM3NCwiZXhwIjoyMDUxNjM5Mzc0fQ.lkcfXhq6hkan7J6dYloT8FbKA4NBvK_YV5815V2dCBE';

// Bot configuration
const BOT_ID = '1F3D1863'; // Use the provided bot ID
const WEBHOOK_SECRET = '477d35eb6ad3193e314e50c81ed872c8e3267b3033bd6351000e35b49882e995'; // Use the provided webhook secret

async function createTestBot() {
  try {
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // First, check if the bot already exists
    const { data: existingBot, error: checkError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', BOT_ID)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking for existing bot:', checkError);
      return;
    }
    
    if (existingBot) {
      console.log('Bot already exists:', existingBot);
      
      // Update the webhook secret and add order_size
      const { data: updatedBot, error: updateError } = await supabase
        .from('bots')
        .update({
          webhook_secret: WEBHOOK_SECRET,
          order_size: 50 // Add order size (50%)
        })
        .eq('id', BOT_ID)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating bot:', updateError);
        return;
      }
      
      console.log('Updated bot with webhook secret and order size:', updatedBot);
      return;
    }
    
    // Get the first user from the auth.users table
    const { data: users, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1);
    
    if (userError) {
      console.error('Error fetching users:', userError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.error('No users found in the database');
      return;
    }
    
    const userId = users[0].id;
    
    // Create a new bot
    const botData = {
      id: BOT_ID,
      user_id: userId,
      name: 'Test Bot',
      exchange: 'hyperliquid',
      pair: 'BTC/USDC',
      max_position_size: 100,
      stoploss_percentage: 2,
      enabled: true,
      api_key: 'test_api_key',
      api_secret: 'test_api_secret',
      webhook_secret: WEBHOOK_SECRET,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: newBot, error: insertError } = await supabase
      .from('bots')
      .insert(botData)
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating bot:', insertError);
      return;
    }
    
    console.log('Created new bot:', newBot);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createTestBot().catch(console.error); 