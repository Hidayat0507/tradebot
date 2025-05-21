'use client'

import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as ccxt from 'ccxt'
import { createClient } from '@/utils/supabase/client'

interface BotBalanceProps {
  botId: string
}

interface CurrencyBalance {
  free: number
  used: number
  total: number
}

// Define a type for the CCXT balance object
interface CcxtBalance {
  free: Record<string, number>;
  used: Record<string, number>;
  total: Record<string, number>;
  info: any;
  [key: string]: any;
}

export function BotBalance({ botId }: BotBalanceProps) {
  const [balance, setBalance] = useState<Record<string, CurrencyBalance> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [botDetails, setBotDetails] = useState<{
    exchange: string;
    api_key: string;
    api_secret: string;
  } | null>(null)
  
  const supabase = createClient()

  // First, get the bot details
  useEffect(() => {
    async function getBotDetails() {
      try {
        setLoading(true);
        
        if (!botId) {
          throw new Error('Bot ID is missing');
        }
        
        // Fetch bot details directly from Supabase
        const { data: bot, error: fetchError } = await supabase
          .from('bots')
          .select('exchange, api_key, api_secret')
          .eq('id', botId)
          .single();
        
        if (fetchError || !bot) {
          throw new Error(fetchError?.message || 'Failed to fetch bot details');
        }
        
        console.log('Bot details from Supabase:', bot);
        
        // Validate required API credentials
        if (!bot.exchange || !bot.api_key || !bot.api_secret) {
          const missing = [];
          if (!bot.exchange) missing.push('exchange name');
          if (!bot.api_key) missing.push('API key');
          if (!bot.api_secret) missing.push('API secret');
          
          console.error('Missing required bot configuration:', {
            receivedFields: Object.keys(bot),
            missingFields: missing,
            botId
          });
          
          throw new Error(`Incomplete bot configuration: missing ${missing.join(', ')}`);
        }
        
        // Save bot credentials to state
        setBotDetails({
          exchange: bot.exchange,
          api_key: bot.api_key,
          api_secret: bot.api_secret
        });
        
        // Now fetch the balance
        await fetchBalanceWithCCXT(bot.exchange, bot.api_key, bot.api_secret);
      } catch (err: any) {
        console.error('Error fetching bot details:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    if (botId) {
      getBotDetails();
    }
  }, [botId, supabase]);
  
  // Function to fetch balance directly with CCXT
  async function fetchBalanceWithCCXT(exchange: string, apiKey: string, apiSecret: string) {
    try {
      setLoading(true);
      setError(null);
      
      // Validate inputs to prevent runtime errors
      if (!exchange) {
        throw new Error('Exchange name is missing');
      }
      
      if (!apiKey || !apiSecret) {
        throw new Error('API credentials are incomplete');
      }
      
      console.log(`Fetching balance for ${exchange}...`);
      
      // Special handling for Hyperliquid - with null safety
      const isHyperliquid = exchange.toLowerCase() === 'hyperliquid';
      
      // Need to use type assertion because TypeScript doesn't know about dynamic indexing
      const ExchangeClass = (ccxt as any)[exchange.toLowerCase()];
      if (!ExchangeClass) {
        throw new Error(`Exchange ${exchange} is not supported by CCXT`);
      }
      
      const exchangeInstance = new ExchangeClass({
        apiKey: apiKey,
        secret: apiSecret
      });
      
      // First try fetching balance without special parameters
      let rawBalance: CcxtBalance;
      
      try {
        // Try normal balance fetch first
        rawBalance = await exchangeInstance.fetchBalance() as CcxtBalance;
        
        // Check if we got any currencies (basic validation)
        const hasCurrencies = rawBalance && 
          rawBalance.total && 
          Object.keys(rawBalance.total).length > 0;
          
        if (!hasCurrencies) {
          throw new Error('No currencies found in balance');
        }
      } catch (normalFetchErr) {
        console.warn('Normal balance fetch failed, trying with spot type', normalFetchErr);
        
        // Try with spot parameters next
        try {
          if (isHyperliquid) {
            // For Hyperliquid, include both type:'spot' and user parameters
            rawBalance = await exchangeInstance.fetchBalance({
              type: 'spot',
              user: apiKey // Use apiKey as wallet address for Hyperliquid
            }) as CcxtBalance;
          } else {
            // For other exchanges, just try with type:'spot'
            rawBalance = await exchangeInstance.fetchBalance({
              type: 'spot'
            }) as CcxtBalance;
          }
        } catch (spotFetchErr) {
          console.error('Spot balance fetch also failed', spotFetchErr);
          throw new Error(`Failed to fetch balance: ${spotFetchErr instanceof Error ? spotFetchErr.message : 'Unknown error'}`);
        }
      }
      
      console.log('Balance fetched successfully via CCXT:', rawBalance);
      
      // Convert to component's format
      const formattedBalance: Record<string, CurrencyBalance> = {};
      Object.keys(rawBalance.total || {}).forEach(currency => {
        formattedBalance[currency] = {
          free: rawBalance.free[currency] || 0,
          used: rawBalance.used[currency] || 0,
          total: rawBalance.total[currency] || 0
        }
      });
      
      setBalance(formattedBalance);
    } catch (err: any) {
      console.error('Error fetching balance with CCXT:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  // Function to refresh balance
  async function refreshBalance() {
    try {
      if (!botId) {
        setError('Bot ID is missing');
        return;
      }
      
      setLoading(true);
      
      // Fetch fresh bot details directly from Supabase
      const { data: bot, error: fetchError } = await supabase
        .from('bots')
        .select('exchange, api_key, api_secret')
        .eq('id', botId)
        .single();
      
      if (fetchError || !bot) {
        throw new Error(fetchError?.message || 'Failed to refresh bot details');
      }
      
      // Validate required API credentials
      if (!bot.exchange || !bot.api_key || !bot.api_secret) {
        const missing = [];
        if (!bot.exchange) missing.push('exchange name');
        if (!bot.api_key) missing.push('API key');
        if (!bot.api_secret) missing.push('API secret');
        
        throw new Error(`Cannot refresh: missing ${missing.join(', ')}`);
      }
      
      // Update bot details in state
      setBotDetails({
        exchange: bot.exchange,
        api_key: bot.api_key,
        api_secret: bot.api_secret
      });
      
      // Fetch balance with fresh credentials
      await fetchBalanceWithCCXT(bot.exchange, bot.api_key, bot.api_secret);
    } catch (err: any) {
      console.error('Error refreshing balance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center text-gray-500">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </div>
    )
  }
  
  if (error) {
    // Determine if this is an API credential issue
    const isCredentialIssue = 
      error.includes('API credentials') || 
      error.includes('Authentication failed') || 
      error.includes('Permission denied') ||
      error.includes('decrypt');
    
    return (
      <div className="text-sm">
        <div className="flex items-start gap-2 text-red-500 mb-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error:</p>
            <p>{error}</p>
            {isCredentialIssue && (
              <a 
                href={`/bots/${botId}/settings`} 
                className="text-blue-500 hover:text-blue-700 block mt-1"
              >
                Update API credentials
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  // Always show BTC and USDC balances, even if no data is available
  const defaultBalance = { total: 0, free: 0, used: 0 };
  
  // If no balance data, show zeros for BTC and USDC
  if (!balance || Object.keys(balance).length === 0) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="font-medium">BTC:</span>
          <span>0.00000000</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium">USDC:</span>
          <span>$0.00</span>
        </div>
        <div className="pt-1 flex items-center gap-2">
          <span className="text-xs text-gray-400">No balance data</span>
        </div>
      </div>
    )
  }
  
  // Get BTC and USDC balances if available
  const btcBalance = balance['BTC'] || balance['UBTC'] || balance['btc'] || balance['ubtc'] || defaultBalance;
  const usdcBalance = balance['USDC'] || balance['usdc'] || defaultBalance;
  
  // Get other top currencies (excluding BTC/UBTC and USDC that we've already shown)
  const otherCurrencies = Object.entries(balance)
    .filter(([curr]) => !['BTC', 'UBTC', 'USDC', 'btc', 'ubtc', 'usdc'].includes(curr))
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 2); // Show 2 more currencies besides BTC and USDC
  
  return (
    <div className="space-y-1">
      {/* Always show BTC and USDC balances */}
      <div className="flex justify-between text-sm">
        <span className="font-medium">BTC:</span>
        <span>{btcBalance.total.toFixed(8)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="font-medium">USDC:</span>
        <span>${usdcBalance.total.toFixed(2)}</span>
      </div>
      
      {/* Show other top currencies */}
      {otherCurrencies.map(([currency, data]) => (
        <div key={currency} className="flex justify-between text-sm">
          <span className="font-medium">{currency}:</span>
          <span>{data.total.toFixed(4)}</span>
        </div>
      ))}
    </div>
  )
}
