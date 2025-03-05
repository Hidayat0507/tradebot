const fetch = require('node-fetch');
const ccxt = require('ccxt');
const readline = require('readline');

// Configuration
const BOT_ID = '1F3D1863';
const WEBHOOK_SECRET = '477d35eb6ad3193e314e50c81ed872c8e3267b3033bd6351000e35b49882e995';
const WEBHOOK_URL = 'http://localhost:3002/api/webhook';

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to check if simulation mode is enabled
async function checkSimulationMode() {
  try {
    // Make a simple request to check if simulation mode is enabled
    const response = await fetch(`${WEBHOOK_URL}/status`, {
      method: 'GET',
    }).catch(() => ({ ok: false }));
    
    if (!response.ok) {
      console.log('Could not determine simulation mode. Server may not be running.');
      return null;
    }
    
    const data = await response.json();
    return data.simulation_mode === true;
  } catch (error) {
    console.log('Could not determine simulation mode:', error.message);
    return null;
  }
}

// Function to get user confirmation
function confirmAction(message) {
  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Function to check available symbols
async function checkAvailableSymbols() {
  try {
    // Create exchange client (using Hyperliquid instead of Binance)
    const exchange = new ccxt.hyperliquid();
    
    // Load markets
    await exchange.loadMarkets();
    
    // Get all symbols
    const symbols = Object.keys(exchange.markets);
    
    console.log('Available Hyperliquid symbols:');
    console.log(symbols); // Show all symbols (Hyperliquid has fewer)
    
    // For Hyperliquid, symbols are typically just the base currency
    // For example, BTC instead of BTC/USDT
    console.log('\nHyperliquid symbol format examples:');
    for (const symbol of symbols.slice(0, 5)) {
      const market = exchange.markets[symbol];
      console.log(`Symbol: ${symbol}, Base: ${market.base}, Quote: ${market.quote}`);
    }
    
    return symbols;
  } catch (error) {
    console.error('Error checking symbols:', error);
    return [];
  }
}

// Function to test webhook with different symbol formats
async function testWebhook(symbol = 'BTCUSDT', amount = null, price = null) {
  console.log(`Testing webhook with symbol: ${symbol}${amount ? `, amount: ${amount}` : ''}${price ? `, price: ${price}` : ''}`);
  
  try {
    const payload = {
      bot_id: BOT_ID,
      symbol: symbol,
      action: 'BUY',
      secret: WEBHOOK_SECRET
    };
    
    // Add amount if provided
    if (amount !== null) {
      payload.amount = amount;
    }
    
    // Add price if provided
    if (price !== null) {
      payload.price = price;
    }
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    console.log(`> Result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.error('Error testing webhook:', error);
    return { success: false, error: error.message };
  }
}

// Test a sell order
async function testSellOrder(symbol = 'ETHUSDT', amount = null) {
  console.log(`Testing SELL order for symbol: ${symbol}`);
  
  try {
    const payload = {
      bot_id: BOT_ID,
      symbol: symbol,
      action: 'SELL',
      secret: WEBHOOK_SECRET
    };
    
    // Add amount if provided
    if (amount !== null) {
      payload.amount = amount;
    }
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    console.log(`> SELL order result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.error('Error testing SELL order:', error);
    return { success: false, error: error.message };
  }
}

// Test with stop loss
async function testWithStopLoss(symbol = 'SOLUSDT', stoplossPercent = 2, amount = null) {
  console.log(`Testing BUY order with ${stoplossPercent}% stop loss for symbol: ${symbol}`);
  
  try {
    const payload = {
      bot_id: BOT_ID,
      symbol: symbol,
      action: 'BUY',
      stoplossPercent: stoplossPercent,
      secret: WEBHOOK_SECRET
    };
    
    // Add amount if provided
    if (amount !== null) {
      payload.amount = amount;
    }
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    console.log(`> Stop loss order result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.error('Error testing stop loss order:', error);
    return { success: false, error: error.message };
  }
}

// Main function
async function main() {
  try {
    // Check if simulation mode is enabled
    const isSimulationMode = await checkSimulationMode();
    console.log(`Simulation mode is ${isSimulationMode === true ? 'enabled' : 'disabled'}`);
    
    // If command line arguments are provided, use them
    if (process.argv.length > 2) {
      const symbol = process.argv[2];
      const amount = process.argv.length > 3 ? parseFloat(process.argv[3]) : null;
      const price = process.argv.length > 4 ? parseFloat(process.argv[4]) : null;
      
      console.log('\nTesting BUY order with custom parameters:');
      await testWebhook(symbol, amount, price);
      rl.close();
      return;
    }
    
    // Otherwise run standard tests
    console.log('Running standard tests in simulation mode...');
    
    // Test with a few different symbols
    await testWebhook('BTCUSDT');
    
    // Test with a sell order
    console.log('\nTesting SELL order:');
    await testSellOrder('ETHUSDT');
    
    // Test with stop loss
    console.log('\nTesting with stop loss:');
    await testWithStopLoss('SOLUSDT', 2);
    
    // Test with market price
    console.log('\nTesting with market price (no price specified):');
    await testWebhook('BTC/USDC:USDC', 10);
    
    // Test with specific price
    console.log('\nTesting with specific price:');
    await testWebhook('BTC/USDC:USDC', 10, 65000);
    
    rl.close();
  } catch (error) {
    console.error('Error in main function:', error);
    rl.close();
  }
}

// Export functions for use in other scripts
module.exports = {
  testWebhook,
  testSellOrder,
  testWithStopLoss
};

// Run main function if this script is executed directly
if (require.main === module) {
  main();
} 