"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { createClient } from '@/utils/supabase/client';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import ExchangePieChart from './components/exchange-pie-chart';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  RefreshCcw, 
  Search, 
  Wallet, 
  TrendingUp, 
  Building2,
  Plus,
  Loader2,
  DollarSign
} from 'lucide-react';
import Link from 'next/link';

Chart.register(ArcElement, Tooltip, Legend);

interface Bot {
  id: string;
  name: string;
  exchange: string;
  pair: string;
}

interface BotBalance {
  botId: string;
  balance: Record<string, { total: number; free: number; used: number }>;
  usdValue: number;
  loading: boolean;
  error: string | null;
}

// Simple crypto price API - using CoinGecko as fallback
const CRYPTO_PRICES: Record<string, number> = {
  'BTC': 50000,
  'ETH': 3000,
  'BNB': 300,
  'SOL': 100,
  'XRP': 0.5,
  'ADA': 0.3,
  'USDT': 1,
  'USDC': 1,
  'BUSD': 1,
  'DAI': 1,
};

async function fetchCryptoPrice(symbol: string): Promise<number> {
  // Return cached price if available
  if (CRYPTO_PRICES[symbol.toUpperCase()]) {
    return CRYPTO_PRICES[symbol.toUpperCase()];
  }
  
  // For unknown crypto, return 0 (or could fetch from API)
  return 0;
}

export default function AssetsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Map<string, BotBalance>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterExchange, setFilterExchange] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('bots')
        .select('id, name, exchange, pair');
      if (error) throw error;
      setBots(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load bots'
      setError(message)
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchBotBalance = useCallback(async (botId: string) => {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined = undefined;

    try {
      timeoutId = setTimeout(() => controller.abort(), 18000); // 18 second timeout (before Vercel's 20s limit)
      
      setBalances(prev => new Map(prev).set(botId, {
        botId,
        balance: {},
        usdValue: 0,
        loading: true,
        error: null
      }));

      const response = await fetch(`/api/exchange/balance?botId=${encodeURIComponent(botId)}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal // Add abort signal for timeout
      });

      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }

      const payload = await response.json();
      const balanceData = payload?.data?.balance as {
        total?: Record<string, number>
        free?: Record<string, number>
        used?: Record<string, number>
      } | undefined;

      if (!balanceData || !balanceData.total) {
        setBalances(prev => new Map(prev).set(botId, {
          botId,
          balance: {},
          usdValue: 0,
          loading: false,
          error: null
        }));
        return;
      }

      // Format balance
      const formatted: Record<string, { total: number; free: number; used: number }> = {};
      for (const currency of Object.keys(balanceData.total)) {
        formatted[currency] = {
          total: balanceData.total?.[currency] ?? 0,
          free: balanceData.free?.[currency] ?? 0,
          used: balanceData.used?.[currency] ?? 0
        };
      }

      // Calculate USD value
      let totalUsdValue = 0;
      for (const [currency, data] of Object.entries(formatted)) {
        const price = await fetchCryptoPrice(currency);
        totalUsdValue += data.total * price;
      }

      setBalances(prev => new Map(prev).set(botId, {
        botId,
        balance: formatted,
        usdValue: totalUsdValue,
        loading: false,
        error: null
      }));
    } catch (err: unknown) {
      // Handle AbortError (timeout) specifically
      if (err instanceof Error && err.name === 'AbortError') {
        setBalances(prev => new Map(prev).set(botId, {
          botId,
          balance: {},
          usdValue: 0,
          loading: false,
          error: 'Request timeout - exchange may be slow or unreachable'
        }));
      } else {
        const message = err instanceof Error ? err.message : 'Failed to fetch balance';
        setBalances(prev => new Map(prev).set(botId, {
          botId,
          balance: {},
          usdValue: 0,
          loading: false,
          error: message
        }));
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId); // Ensure timeout is always cleared
      }
    }
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    if (bots.length > 0) {
      bots.forEach(bot => fetchBotBalance(bot.id));
    }
  }, [bots, fetchBotBalance]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBots();
    if (bots.length > 0) {
      await Promise.all(bots.map(bot => fetchBotBalance(bot.id)));
    }
    setRefreshing(false);
  }, [fetchBots, fetchBotBalance, bots]);

  // Filter and search
  const filteredBots = useMemo(() => {
    return bots.filter(bot => {
      const matchesSearch = bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           bot.pair.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesExchange = filterExchange === 'all' || bot.exchange === filterExchange;
      return matchesSearch && matchesExchange;
    });
  }, [bots, searchQuery, filterExchange]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalValue = Array.from(balances.values()).reduce((sum, b) => sum + b.usdValue, 0);
    const uniqueAssets = new Set<string>();
    balances.forEach(b => {
      Object.keys(b.balance).forEach(asset => uniqueAssets.add(asset));
    });
    const uniqueExchanges = new Set(bots.map(b => b.exchange));

    return {
      totalValue,
      totalAssets: uniqueAssets.size,
      totalExchanges: uniqueExchanges.size,
    };
  }, [balances, bots]);

  const uniqueExchanges = Array.from(new Set(bots.map(b => b.exchange)));

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-500">
                <p className="text-lg font-semibold mb-2">Error Loading Assets</p>
                <p>{error}</p>
                <Button onClick={handleRefresh} className="mt-4">
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (bots.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <Wallet className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No Bots Connected</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Connect your first trading bot to start tracking your portfolio
                </p>
                <Button asChild>
                  <Link href="/bots/create">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Bot
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Portfolio Overview
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              View your asset balances across all connected bots and exchanges
            </p>
          </div>
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            variant="outline"
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Across all exchanges
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAssets}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Unique currencies held
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected Exchanges</CardTitle>
              <Building2 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalExchanges}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {bots.length} bot{bots.length !== 1 ? 's' : ''} active
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pie Chart */}
        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Asset Distribution</CardTitle>
            <CardDescription>Breakdown of your portfolio by exchange</CardDescription>
          </CardHeader>
          <CardContent>
            <ExchangePieChart bots={bots} />
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Bot Balances</CardTitle>
            <CardDescription>Detailed balance information for each bot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search bots by name or pair..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterExchange} onValueChange={setFilterExchange}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by exchange" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exchanges</SelectItem>
                  {uniqueExchanges.map(exchange => (
                    <SelectItem key={exchange} value={exchange}>
                      {exchange.charAt(0).toUpperCase() + exchange.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bot Name</TableHead>
                    <TableHead>Exchange</TableHead>
                    <TableHead>Trading Pair</TableHead>
                    <TableHead>Assets</TableHead>
                    <TableHead className="text-right">USD Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        No bots found matching your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBots.map(bot => {
                      const botBalance = balances.get(bot.id);
                      return (
                        <TableRow key={bot.id}>
                          <TableCell className="font-medium">{bot.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {bot.exchange.charAt(0).toUpperCase() + bot.exchange.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{bot.pair}</Badge>
                          </TableCell>
                          <TableCell>
                            {botBalance?.loading ? (
                              <div className="flex items-center text-gray-500">
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                Loading...
                              </div>
                            ) : botBalance?.error ? (
                              <div className="text-red-500 text-sm">{botBalance.error}</div>
                            ) : (
                              <div className="space-y-1">
                                {Object.entries(botBalance?.balance || {})
                                  .filter(([, data]) => data.total > 0)
                                  .slice(0, 3)
                                  .map(([currency, data]) => {
                                    // Format stablecoins with 2 decimals, other crypto with 4
                                    const isStablecoin = ['USDT', 'USDC', 'BUSD', 'DAI', 'USDD', 'TUSD', 'USDP'].includes(currency.toUpperCase());
                                    const formattedAmount = isStablecoin 
                                      ? data.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                      : data.total.toFixed(4);
                                    
                                    return (
                                      <div key={currency} className="text-sm">
                                        <span className="font-medium">{currency}:</span>{' '}
                                        {formattedAmount}
                                      </div>
                                    );
                                  })}
                                {Object.keys(botBalance?.balance || {}).length > 3 && (
                                  <div className="text-xs text-gray-500">
                                    +{Object.keys(botBalance?.balance || {}).length - 3} more
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {botBalance?.loading ? (
                              <Skeleton className="h-4 w-20 ml-auto" />
                            ) : (
                              <span className="text-green-600">
                                ${botBalance?.usdValue.toLocaleString(undefined, { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 2 
                                })}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
} 
