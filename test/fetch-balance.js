// Simple script to fetch and log Hyperliquid balance
const ccxt = require('ccxt');

async function fetchAndLogBalance() {
  try {
    console.log('Creating exchange client...');
    
    const walletAddress = '0x9d0B4993F01daC4Afad4F3F8E55f828c8B459Af4';
    
    // Create exchange client with correct credentials
    const exchange = new ccxt['hyperliquid']({
      apiKey: walletAddress, // Wallet address
      secret: 'e22cc3d73967d8d76ebec477e8d44f0dbcf61a2b15c046e962a7a5938b9f5d61', // API secret
      privateKey: 'e22cc3d73967d8d76ebec477e8d44f0dbcf61a2b15c046e962a7a5938b9f5d61', // Private key for signing
      walletAddress: walletAddress // Required for order signing
    });
    
    console.log('Exchange ID:', exchange.id);
    
    // Fetch spot balance
    console.log('\n==== FETCHING SPOT BALANCE ====');
    try {
      const spotBalance = await exchange.fetchBalance({
        type: 'spot',
        user: '0x9d0B4993F01daC4Afad4F3F8E55f828c8B459Af4'
      });
      
      console.log('\nSpot balance fetch successful!');
      console.log('USDC balance:', spotBalance['USDC'] || 'Not found');
      console.log('UBTC balance:', spotBalance['UBTC'] || 'Not found');
      
      // Simulate order size calculation
      console.log('\n==== SIMULATING BUY ORDER CALCULATION ====');
      const available = spotBalance['USDC'].free;
      const price = 81500; // Price from your webhook test
      const percentage = 100; // Using 100% as default
      
      console.log('\nInput values:');
      console.log('- Available USDC:', available);
      console.log('- Price per UBTC:', price);
      console.log('- Order size percentage:', percentage + '%');
      
      // Calculate position size in USDC
      const positionSize = (available * percentage) / 100;
      console.log('\nStep 1: Calculate position size in USDC');
      console.log('positionSize = (available * percentage) / 100');
      console.log(`positionSize = (${available} * ${percentage}) / 100 = ${positionSize} USDC`);
      
      // Calculate amount of UBTC we can buy
      let amount = positionSize / price;
      console.log('\nStep 2: Calculate UBTC amount');
      console.log('amount = positionSize / price');
      console.log(`amount = ${positionSize} / ${price} = ${amount} UBTC`);
      
      // Round down to 5 decimal places for Hyperliquid
      amount = Math.floor(amount * 100000) / 100000;
      console.log('\nStep 3: Round down to 5 decimal places');
      console.log(`amount = Math.floor(${amount} * 100000) / 100000 = ${amount} UBTC`);
      
      // Check minimum order value
      const orderValueUSD = amount * price;
      const minOrderValue = 10; // $10 minimum
      
      console.log('\nStep 4: Check minimum order value');
      console.log(`Order value = ${amount} UBTC * ${price} USDC = ${orderValueUSD} USDC`);
      console.log(`Minimum required: ${minOrderValue} USDC`);
      
      if (orderValueUSD < minOrderValue) {
        console.log('\nOrder value too small, adjusting...');
        // Adjust amount to meet minimum with a 10% buffer
        amount = (minOrderValue * 1.1) / price;
        console.log(`New amount = (${minOrderValue} * 1.1) / ${price} = ${amount} UBTC`);
        
        // Round down to 5 decimal places
        amount = Math.floor(amount * 100000) / 100000;
        console.log(`Rounded = ${amount} UBTC`);
        
        // Calculate final order value
        const finalOrderValue = amount * price;
        console.log(`Final order value = ${amount} UBTC * ${price} USDC = ${finalOrderValue} USDC`);
      }
      
      console.log('\nFinal order amount:', amount, 'UBTC');
      
      // Try to place the actual order
      console.log('\n==== PLACING TEST ORDER ====');
      try {
        const orderOptions = {
          type: 'limit',
          slippage: 0.05
        };
        
        console.log('\nOrder parameters:');
        console.log('- Symbol:', 'UBTC/USDC');
        console.log('- Type:', 'limit');
        console.log('- Side:', 'buy');
        console.log('- Amount:', amount);
        console.log('- Price:', price);
        console.log('- Options:', orderOptions);
        
        const order = await exchange.createOrder(
          'UBTC/USDC',
          'limit',
          'buy',
          amount,
          price,
          orderOptions
        );
        
        console.log('\nOrder placed successfully:', order);
      } catch (orderErr) {
        console.error('\nOrder placement failed:', orderErr.message);
        if (orderErr.message.includes('zero size')) {
          console.log('\nAnalyzing amount format:');
          console.log('- Amount type:', typeof amount);
          console.log('- Amount value:', amount);
          console.log('- Amount in scientific:', amount.toExponential());
          console.log('- Amount as string:', amount.toString());
          console.log('- Amount fixed decimal:', amount.toFixed(5));
        }
      }
      
    } catch (err) {
      console.error('Error:', err.message);
      console.error('Full error:', err);
    }
    
  } catch (error) {
    console.error('Unhandled error:', error);
  }
}

fetchAndLogBalance().catch(console.error); 