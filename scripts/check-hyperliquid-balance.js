// Quick script to check Hyperliquid balance for all bots
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHyperliquidBalances() {
  console.log('🔍 Fetching Hyperliquid bots...\n');

  try {
    // Fetch all Hyperliquid bots
    const { data: bots, error } = await supabase
      .from('bots')
      .select('id, name, user_id, exchange, pair')
      .eq('exchange', 'hyperliquid');

    if (error) {
      throw error;
    }

    if (!bots || bots.length === 0) {
      console.log('ℹ️  No Hyperliquid bots found in the database.');
      return;
    }

    console.log(`Found ${bots.length} Hyperliquid bot(s):\n`);

    for (const bot of bots) {
      console.log(`📊 Bot: ${bot.name}`);
      console.log(`   ID: ${bot.id}`);
      console.log(`   Pair: ${bot.pair}`);
      console.log(`   User ID: ${bot.user_id}`);
      console.log('');
    }

    console.log('\n💡 To check the actual balance:');
    console.log('   1. Make sure you\'ve applied the RLS policies migration');
    console.log('   2. Go to your app at /assets page');
    console.log('   3. Or use the API: GET /api/exchange/balance?botId=BOT_ID');
    console.log('\n   Example API call:');
    console.log(`   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\`);
    console.log(`        "http://localhost:3000/api/exchange/balance?botId=${bots[0]?.id}"`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkHyperliquidBalances();

