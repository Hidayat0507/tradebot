# Trading Bot API Documentation

This document provides comprehensive documentation for the Trading Bot API, which allows you to execute trades and manage your bots programmatically.

## Table of Contents

- [Webhook API](#webhook-api)
  - [Endpoint](#endpoint)
  - [Authentication](#authentication)
  - [Required Parameters](#required-parameters)
  - [Trade Size Parameters](#trade-size-parameters)
  - [Optional Parameters](#optional-parameters)
  - [Example Requests](#example-requests)
  - [Response Format](#response-format)
  - [Error Handling](#error-handling)
- [Status API](#status-api)
- [TradingView Integration](#tradingview-integration)
- [Market Data Caching](#market-data-caching)
- [Best Practices](#best-practices)

## Webhook API

The Webhook API allows you to trigger trades from external systems like TradingView or custom trading algorithms.

### Endpoint

```
POST /api/webhook
```

### Authentication

All requests to the webhook API must include the bot's webhook secret for authentication. This secret is generated when you create a bot and can be regenerated from the bot's settings page.

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `bot_id` | string | Your bot's unique identifier |
| `symbol` | string | Trading pair in exchange format (e.g., "BTC/USDC:USDC" for Hyperliquid) |
| `action` | string | Must be "buy" or "sell" (case-insensitive) |
| `secret` | string | Your webhook secret for authentication |

### Trade Size Parameters

You must specify one of the following parameters to determine the size of your trade:

| Parameter | Type | Description |
|-----------|------|-------------|
| `order_size` | number | Percentage of available balance to use (25, 50, 75, or 100). If not provided, defaults to the bot's configured order_size or 100% |
| `amount` | number | Direct amount to trade (e.g., 0.001 BTC). Takes precedence over order_size if both are provided |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `price` | number | Optional price for limit orders. If not provided, market orders will be executed at the current price |
| `strategy` | string | Optional strategy name for tracking. Useful for analyzing performance by strategy |
| `stoplossPercent` | number | Optional stoploss percentage. Sets a stop loss at the specified percentage below entry price (for BUY orders) |

### Example Requests

#### Buy with Order Size (50%)

```json
{
  "bot_id": "1F3D1863",
  "symbol": "BTC/USDC:USDC",
  "action": "BUY",
  "order_size": 50,
  "secret": "477d35eb6ad3193e314e50c81ed872c8e3267b3033bd6351000e35b49882e995"
}
```

#### Sell with Order Size (100%)

```json
{
  "bot_id": "1F3D1863",
  "symbol": "BTC/USDC:USDC",
  "action": "SELL",
  "order_size": 100,
  "secret": "477d35eb6ad3193e314e50c81ed872c8e3267b3033bd6351000e35b49882e995"
}
```

#### Buy with Direct Amount

```json
{
  "bot_id": "1F3D1863",
  "symbol": "BTC/USDC:USDC",
  "action": "BUY",
  "amount": 0.001,
  "secret": "477d35eb6ad3193e314e50c81ed872c8e3267b3033bd6351000e35b49882e995"
}
```

#### Advanced Example with Limit Price and Stoploss

```json
{
  "bot_id": "1F3D1863",
  "symbol": "ETH/USDC:USDC",
  "action": "BUY",
  "order_size": 25,
  "price": 3500,
  "strategy": "EMA Crossover",
  "stoplossPercent": 2,
  "secret": "477d35eb6ad3193e314e50c81ed872c8e3267b3033bd6351000e35b49882e995"
}
```

### Response Format

#### Successful Response

```json
{
  "success": true,
  "trade": {
    "id": "123456",
    "user_id": "user_123",
    "bot_id": "1F3D1863",
    "external_id": "exchange_order_id_123",
    "symbol": "BTC/USDC:USDC",
    "side": "buy",
    "status": "filled",
    "size": 0.001,
    "price": 65000,
    "pnl": null
  }
}
```

### Error Handling

The API returns appropriate HTTP status codes along with error messages in the response body.

#### Common Error Responses

**Authentication Error (401):**
```json
{
  "success": false,
  "error": "Invalid webhook secret"
}
```

**Not Found Error (404):**
```json
{
  "success": false,
  "error": "Bot not found"
}
```

**Validation Error (400):**
```json
{
  "success": false,
  "error": "Missing required fields: symbol, action"
}
```

**Market Error (400):**
```json
{
  "success": false,
  "error": "Failed to execute trade: Market 'INVALID/USDC:USDC' not found"
}
```

**Exchange Error (500):**
```json
{
  "success": false,
  "error": "Failed to execute trade: hyperliquid {\"status\":\"ok\",\"response\":{\"type\":\"order\",\"data\":{\"statuses\":[{\"error\":\"Order has zero size.\"}]}}}"
}
```

## Status API

The Status API allows you to check if the server is in simulation mode.

### Endpoint

```
GET /api/webhook/status
```

### Response Format

```json
{
  "status": "ok",
  "simulation_mode": false,
  "server_time": "2023-03-05T08:55:53.008Z"
}
```

## TradingView Integration

### TradingView Alert Setup
1. Create a new alert in TradingView
2. In the "Alert message" field, use the following JSON template:

```json
{
  "bot_id": "YOUR_BOT_ID",
  "symbol": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "order_size": 50,
  "strategy": "{{strategy.name}}",
  "secret": "YOUR_WEBHOOK_SECRET"
}
```

3. Set the webhook URL to your server's webhook endpoint
4. Configure the alert conditions according to your trading strategy

**Note:** TradingView variables like `{{ticker}}` and `{{strategy.order.action}}` will be replaced with actual values when the alert triggers.

## Market Data Caching

The system implements a market data caching mechanism to reduce the frequency of API calls to exchanges. This improves performance and reduces the risk of rate limiting.

| Data Type | Cache Duration |
|-----------|---------------|
| Ticker data | 5 seconds |
| Order book data | 5 seconds |
| OHLCV data | 60 seconds |

This means that multiple trades executed within these time windows will use the same market data, improving performance and consistency.

## Best Practices

1. **Use Correct Symbol Format**: Always use the correct symbol format for your exchange (e.g., "BTC/USDC:USDC" for Hyperliquid)

2. **Secure Your Webhook Secret**: Keep your webhook secret secure and regenerate it if you suspect it has been compromised

3. **Handle Errors Gracefully**: Implement proper error handling in your integration to handle API errors

4. **Test in Simulation Mode**: Use the simulation mode for testing before executing real trades

5. **Monitor Rate Limits**: Be aware of exchange rate limits and avoid sending too many requests in a short period

6. **Use Order Size Wisely**: Start with smaller order sizes (25% or 50%) when testing new strategies

7. **Check Status Endpoint**: Verify if the server is in simulation mode before executing important trades


