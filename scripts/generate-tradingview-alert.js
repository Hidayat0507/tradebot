#!/usr/bin/env node

const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function generateSignature(payload, timestamp, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${timestamp}.${payload}`);
  return hmac.digest('hex');
}

function generateAlertTemplate(strategyName, webhookSecret) {
  // Message template for TradingView
  const messageTemplate = {
    action: "{{strategy.order.action}}",
    symbol: "{{ticker}}",
    price: "{{close}}",
    strategy: strategyName,
    timestamp: "{{time}}"
  };

  // Current timestamp (for example purposes)
  const timestamp = '{{timenow}}';
  
  // Generate example signature
  const examplePayload = JSON.stringify(messageTemplate);
  const exampleSignature = generateSignature(examplePayload, timestamp, webhookSecret);

  console.log('\n=== TradingView Alert Configuration ===\n');
  
  console.log('1. In the "Message" field, paste this:');
  console.log('----------------------------------------');
  console.log(JSON.stringify(messageTemplate, null, 2));
  console.log('----------------------------------------\n');

  console.log('2. In the "Webhook URL" field, enter your webhook URL:');
  console.log('----------------------------------------');
  console.log('https://your-domain.com/api/webhook');
  console.log('----------------------------------------\n');

  console.log('3. In "Additional headers" field, add these headers:');
  console.log('----------------------------------------');
  console.log('x-tradingview-timestamp: {{timenow}}');
  console.log(`x-tradingview-signature: ${exampleSignature}  # This is just an example`);
  console.log('----------------------------------------\n');

  console.log('Important Notes:');
  console.log('1. Replace "your-domain.com" with your actual domain');
  console.log('2. The signature shown is just an example. TradingView will need to calculate this');
  console.log('3. Make sure your WEBHOOK_SECRET in .env matches what you use in TradingView');
  console.log('\nFor more information, check the README.md file.');
}

console.log('TradingView Alert Generator\n');

rl.question('Enter your strategy name: ', (strategyName) => {
  rl.question('Enter your webhook secret (from .env.local): ', (secret) => {
    generateAlertTemplate(strategyName, secret);
    rl.close();
  });
});
