#!/usr/bin/env node

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function generateAlertTemplate(strategyName, webhookSecret) {
  // Message template for TradingView
  const messageTemplate = {
    bot_id: "YOUR_BOT_ID",
    secret: webhookSecret,
    ts: "{{timenow}}",
    alert_id: "{{strategy.order.id}}-{{timenow}}-{{strategy.order.action}}",
    action: "{{strategy.order.action}}",
    symbol: "{{ticker}}",
    price: "{{close}}",
    strategy: strategyName
  };

  console.log('\n=== TradingView Alert Configuration ===\n');
  
  console.log('1. In the "Message" field, paste this:');
  console.log('----------------------------------------');
  console.log(JSON.stringify(messageTemplate, null, 2));
  console.log('----------------------------------------\n');

  console.log('2. In the "Webhook URL" field, enter your webhook URL:');
  console.log('----------------------------------------');
  console.log('https://your-domain.com/api/webhook');
  console.log('----------------------------------------\n');

  console.log('Replace YOUR_BOT_ID with your bot ID and keep the secret private.');
  console.log('Keep alert_id stable on retries and unique for each new event.');
  console.log('Alerts must arrive within the configured replay window (default 60 seconds).');
  console.log('\nFor more information, check the README.md file.');
}

console.log('TradingView Alert Generator\n');

rl.question('Enter your strategy name: ', (strategyName) => {
  rl.question('Enter your webhook secret (from .env.local): ', (secret) => {
    generateAlertTemplate(strategyName, secret);
    rl.close();
  });
});
