# Development Rules

## Testing Guidelines

### File Organization
1. All test files MUST be placed in the existing `src/test` directory
2. DO NOT create new test directories
3. Before creating any new files:
   - Check the codebase for existing files with similar functionality
   - Avoid creating duplicate or redundant files
   - Reuse existing files when possible
4. Follow the existing file structure and naming conventions

### Webhook Testing
When testing webhooks:
1. Base URL: `https://sigmify.netlify.app/api/webhook`
2. Required payload fields:
   - `bot_id`
   - `symbol`
   - `action` (BUY/SELL)
   - `price`
   - `secret`
3. Optional fields:
   - `order_size`
4. Note: Netlify functions have a 10-second timeout limit
5. **Always use curl for testing webhooks**. Example:
   ```bash
   curl -X POST "https://sigmify.netlify.app/api/webhook" \
        -H "Content-Type: application/json" \
        -d '{
          "bot_id": "1F3D1863",
          "symbol": "UBTC/USDC",
          "action": "BUY",
          "price": 82000,
          "order_size": 100,
          "secret": "1656ffecc39a7b50f640d916e8f664361f8b718946395b71c81c38e752249ccb"
        }'
   ```

### Example Webhook Payload
```json
{
    "bot_id": "1F3D1863",
    "symbol": "UBTC/USDC",
    "action": "BUY",
    "price": 82000,
    "order_size": 100,
    "secret": "1656ffecc39a7b50f640d916e8f664361f8b718946395b71c81c38e752249ccb"
}
```

## Split Webhook Architecture

### Overview
The project now supports two webhook approaches:
1. **Original webhook** (`/api/webhook`): Processes everything synchronously (preserved for backward compatibility)
2. **Split webhook system**: Uses multiple endpoints for better performance and reliability

### New Webhook Endpoints
The split webhook architecture includes:
1. **Receive Endpoint** (`/api/webhook/receive`):
   - Quickly validates and queues the webhook
   - Responds immediately with a signal ID
   - Significantly faster than the original endpoint (~10ms vs 3-5s)

2. **Process Endpoint** (`/api/webhook/process`):
   - Handles background processing of the webhook
   - Takes a signal ID from the receive endpoint
   - Performs full webhook processing asynchronously

3. **Status Endpoint** (`/api/webhook/status/:signalId`):
   - Allows checking the status of a webhook signal
   - Reports current status: pending, processing, completed, or failed
   - Includes timestamps and results/errors

### Testing Split Webhook Endpoints

#### Receive Endpoint
```bash
curl -X POST "https://sigmify.netlify.app/api/webhook/receive" \
     -H "Content-Type: application/json" \
     -d '{
       "bot_id": "1F3D1863",
       "symbol": "UBTC/USDC",
       "action": "BUY",
       "price": 82000,
       "secret": "1656ffecc39a7b50f640d916e8f664361f8b718946395b71c81c38e752249ccb"
     }'
```

#### Process Endpoint
```bash
curl -X POST "https://sigmify.netlify.app/api/webhook/process" \
     -H "Content-Type: application/json" \
     -d '{
       "signal_id": "signal-id-from-receive-endpoint"
     }'
```

#### Status Endpoint
```bash
curl "https://sigmify.netlify.app/api/webhook/status/signal-id-from-receive-endpoint"
```

### Local Testing
Run the local test server:
```bash
node src/test/local-webhook-server.js
```

Run the test script:
```bash
node src/test/test-webhooks.js
```

### Database Schema
The split webhook system uses a new `signal_queue` table in Supabase:
- Primary key: `id` (UUID)
- Foreign keys: `bot_id`, `user_id`
- Status field: 'pending', 'processing', 'completed', 'failed'
- Timestamps: `created_at`, `updated_at`, `processing_started_at`, `completed_at`, `failed_at` 