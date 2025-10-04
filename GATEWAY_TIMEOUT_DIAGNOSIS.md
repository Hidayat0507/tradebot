# Gateway Timeout Diagnosis Guide

## 🔍 **What is a Gateway Timeout?**

A **504 Gateway Timeout** error means:
- Your app sent a request
- The server (or intermediary) waited for a response
- The response took too long (exceeded timeout limit)
- The server gave up waiting and returned 504

---

## 🎯 **Where is the Timeout Coming From?**

Based on your codebase analysis:

### **1. CCXT Exchange API Calls (Most Likely Cause)**

#### **Problem:**
Your app makes external API calls to exchanges (Bitget, etc.) which can timeout:

```typescript
// No timeout configured! ⚠️
const bitget = new ccxt.bitget({
  enableRateLimit: true,
  // Missing: timeout configuration
});
```

#### **Timeout Locations:**
1. **Balance Fetching** (`/api/exchange/balance`)
   - Calls `exchange.fetchBalance()`
   - Can timeout if exchange is slow or blocked

2. **Market Data** (`/api/exchange/market`)
   - Calls `exchange.fetchTicker()`
   - Multiple requests if you have many bots

3. **Trade Execution** (`/api/webhook`)
   - Calls `exchange.createOrder()`
   - Network issues can cause delays

4. **Assets Page**
   - Fetches balance for ALL bots
   - If you have 10 bots = 10 API calls
   - One slow call blocks everything

---

## 🌐 **Network Issues in KL (Your Specific Case)**

You mentioned: *"Previously in JB it worked, now in KL it doesn't"*

### **Likely Causes:**

1. **ISP Blocking Crypto Exchanges**
   - Some Malaysian ISPs block or throttle crypto exchange APIs
   - Bitget API might be slow/blocked in KL
   - Different routing in KL vs JB

2. **DNS Issues**
   - ISP DNS might have issues resolving exchange domains
   - Try using Google DNS (8.8.8.8) or Cloudflare DNS (1.1.1.1)

3. **Network Latency**
   - Higher latency to exchange servers from KL
   - Requests take longer than timeout limit

---

## 📊 **Current Timeout Settings Analysis**

### **What I Found:**

#### ❌ **No Timeout Configuration in Exchange Clients**
```typescript
// src/lib/exchanges/bitget.ts
const bitget = new ccxt.bitget({
  enableRateLimit: true,
  // ❌ Missing: timeout
});
```

#### ❌ **No Timeout in API Routes**
- Next.js API routes have default timeouts
- Vercel: 10 seconds (Hobby), 15s (Pro), 60s (Enterprise)
- Self-hosted: Usually 30-60 seconds

#### ❌ **No Request Timeout in Frontend**
```typescript
// Assets page
const response = await fetch(`/api/exchange/balance?botId=${botId}`, {
  method: 'GET',
  cache: 'no-store'
  // ❌ Missing: timeout, signal (AbortController)
});
```

---

## 🔧 **HOW TO FIX**

### **Solution 1: Add Timeout to CCXT Clients** ⭐ **RECOMMENDED**

```typescript
// src/lib/exchanges/bitget.ts
export const bitgetPlugin: ExchangePlugin = {
  id: 'bitget',
  label: 'Bitget',
  requiredCredentials: ['apiKey', 'apiSecret', 'password'],
  createClient: async (credentials?: ResolvedExchangeCredentials) => {
    const options: Record<string, unknown> = {
      enableRateLimit: true,
      timeout: 10000, // ✅ 10 second timeout
      // OR
      timeout: 15000, // ✅ 15 second timeout for slower networks
    }

    if (credentials?.apiKey) {
      options.apiKey = credentials.apiKey
    }
    if (credentials?.apiSecret) {
      options.secret = credentials.apiSecret
    }
    if (credentials?.password) {
      options.password = credentials.password
    }

    return new ccxt.bitget(options)
  },
}
```

**Benefits:**
- ✅ Fails fast instead of hanging
- ✅ Better error messages
- ✅ Can retry or fallback

---

### **Solution 2: Add Frontend Timeout with AbortController**

```typescript
// src/app/assets/page.tsx
const fetchBotBalance = useCallback(async (botId: string) => {
  try {
    // ✅ Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(`/api/exchange/balance?botId=${encodeURIComponent(botId)}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal // ✅ Pass abort signal
    });

    clearTimeout(timeoutId);

    // ... rest of code
  } catch (err) {
    if (err.name === 'AbortError') {
      // ✅ Handle timeout specifically
      setBalances(prev => new Map(prev).set(botId, {
        botId,
        balance: {},
        usdValue: 0,
        loading: false,
        error: 'Request timeout - exchange may be slow or blocked'
      }));
    }
  }
}, []);
```

---

### **Solution 3: Implement Retry Logic**

```typescript
async function fetchWithRetry(url: string, retries = 3, timeout = 10000) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) return response;
    } catch (err) {
      if (i === retries - 1) throw err; // Last retry failed
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
}
```

---

### **Solution 4: Use VPN or Proxy** (Network Issues)

If ISP is blocking/throttling:

1. **Use VPN**
   - Connect to Singapore or US server
   - Test if API calls work

2. **Deploy to Cloud** (Recommended)
   - Vercel, Railway, Render
   - Different network path
   - Usually no ISP restrictions

3. **Change DNS**
   ```bash
   # Use Google DNS
   networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4
   
   # Or Cloudflare DNS
   networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1
   ```

---

### **Solution 5: Optimize Assets Page (Concurrent Requests)**

**Problem:** Loading 10 bots = 10 sequential API calls = slow

**Solution:** Limit concurrent requests and handle failures gracefully

```typescript
// Batch requests in groups of 3
async function fetchBalancesInBatches(bots: Bot[], batchSize = 3) {
  const results = [];
  
  for (let i = 0; i < bots.length; i += batchSize) {
    const batch = bots.slice(i, i + batchSize);
    const batchPromises = batch.map(bot => 
      fetchBotBalance(bot.id).catch(err => ({
        botId: bot.id,
        error: err.message
      }))
    );
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}
```

---

## 🧪 **HOW TO TEST & DIAGNOSE**

### **Test 1: Check if it's Network or Code**

```bash
# Test Bitget API directly
curl -w "\nTime: %{time_total}s\n" "https://api.bitget.com/api/spot/v1/market/ticker?symbol=BTCUSDT_SPBL"
```

**Result Analysis:**
- **< 2 seconds**: Network is fine, issue is in code
- **> 5 seconds**: Network is slow
- **Timeout/Fails**: Network is blocked

---

### **Test 2: Test with Local Timeout**

```bash
# Test with 5 second timeout
curl --max-time 5 "https://api.bitget.com/api/spot/v1/market/ticker?symbol=BTCUSDT_SPBL"
```

If this fails but the previous passes, your timeouts are too aggressive.

---

### **Test 3: Check Vercel Logs** (If Deployed)

```bash
# In Vercel dashboard
# Go to: Deployments → [Your Deployment] → Runtime Logs
# Look for:
#   - "Task timed out after XX seconds"
#   - "Function timeout exceeded"
```

---

### **Test 4: Test in Production vs Local**

1. **Local (dev)**: `bun dev` - should work fine
2. **Production (deployed)**: May timeout differently

---

## 📋 **CHECKLIST: What to Fix**

### **Priority 1 - Critical** (Do First)
- [ ] Add timeout to CCXT exchange clients (10-15s)
- [ ] Add frontend request timeout with AbortController
- [ ] Test if Bitget API works from KL (curl test)

### **Priority 2 - Important**
- [ ] Implement retry logic for API calls
- [ ] Batch balance requests (3 at a time, not all at once)
- [ ] Add better error messages for timeouts

### **Priority 3 - Nice to Have**
- [ ] Add loading progress indicator ("Loading 3/10 bots...")
- [ ] Cache balance data (don't fetch every time)
- [ ] Add "Skip failed" option for slow bots

---

## 🎯 **RECOMMENDED ACTION PLAN**

1. **Immediate Fix** (5 minutes):
   ```bash
   # Test if network is the issue
   curl -w "\nTime: %{time_total}s\n" "https://api.bitget.com/api/spot/v1/market/ticker?symbol=BTCUSDT_SPBL"
   ```

2. **Quick Fix** (15 minutes):
   - Add timeout to Bitget plugin: `timeout: 15000`
   - Add AbortController to assets page fetch

3. **Proper Fix** (1 hour):
   - Implement all timeouts across exchange plugins
   - Add retry logic
   - Batch requests in assets page

4. **Network Fix** (if needed):
   - Use VPN or deploy to cloud
   - Change DNS servers

---

## 🚨 **SPECIFIC TO YOUR CASE**

**You said:** "Before in JB it worked, now in KL it doesn't"

**This strongly suggests:**
- ⚠️ ISP/Network issue in KL
- ⚠️ Not a code issue

**What to try FIRST:**
1. Use mobile hotspot (different ISP) and test
2. If it works → ISP is blocking/throttling
3. Solution: VPN or deploy to cloud

**What to try SECOND:**
1. Add timeouts to code (as described above)
2. This will make it fail faster with better errors
3. You'll know exactly what's timing out

---

## 💡 **QUICK WINS**

```typescript
// 1. Add to bitget.ts (5 minutes)
timeout: 15000

// 2. Test balance API directly
curl "http://localhost:3000/api/exchange/balance?botId=YOUR_BOT_ID"

// 3. Check browser console (F12)
// Look for: "Failed to fetch" or timeout errors
```

---

## 📞 **Need More Help?**

Check these logs:
1. Browser Console (F12)
2. Terminal (where `bun dev` is running)
3. Vercel Dashboard (if deployed)

Look for:
- "timeout"
- "ETIMEDOUT"
- "ECONNREFUSED"
- "NetworkError"
- "504"

This will tell you exactly where it's failing!

