const ccxt = require('ccxt'); async function main() { try { const exchange = new ccxt.hyperliquid(); await exchange.loadMarkets(); const btcMarkets = Object.entries(exchange.markets).filter(([symbol]) => symbol.includes('BTC')); console.log('Bitcoin markets on Hyperliquid:'); for (const [symbol, market] of btcMarkets) { console.log(`${symbol}: type=${market.type}, spot=${market.spot ? 'Yes' : 'No'}, perpetual=${market.swap ? 'Yes' : 'No'}`); } } catch (error) { console.error('Error:', error); } } main();
