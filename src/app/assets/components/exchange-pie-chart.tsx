import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
Chart.register(ArcElement, Tooltip, Legend);

interface BotForChart {
  id: string;
  name: string;
  exchange: string;
}

interface AssetBalance {
  amount: number;
  usdValue: number;
}

interface ExchangeBalances {
  [exchange: string]: {
    [asset: string]: AssetBalance;
  };
}

// Crypto price mapping (same as in page.tsx)
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

function getCryptoPrice(symbol: string): number {
  return CRYPTO_PRICES[symbol.toUpperCase()] || 0;
}

export default function ExchangePieChart({ bots }: { bots: BotForChart[] }) {
  const [exchangeBalances, setExchangeBalances] = useState<ExchangeBalances>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllBalances() {
      setLoading(true);
      setError(null);
      try {
        // Group incoming bots by exchange
        const grouped: Record<string, BotForChart[]> = {};
        bots.forEach((bot) => {
          if (!grouped[bot.exchange]) grouped[bot.exchange] = [];
          grouped[bot.exchange].push(bot);
        });

        // For each exchange, fetch and aggregate balances using the server API per bot
        const balances: ExchangeBalances = {};
        for (const [exchange, botsInExchange] of Object.entries(grouped)) {
          const assetTotals: { [asset: string]: AssetBalance } = {};
          await Promise.all(
            botsInExchange.map(async (bot) => {
              try {
                const res = await fetch(`/api/exchange/balance?botId=${encodeURIComponent(bot.id)}`, {
                  method: 'GET',
                  cache: 'no-store',
                });
                if (!res.ok) return;
                const payload = await res.json();
                const balanceData = payload?.data?.balance as {
                  total?: Record<string, number>
                } | undefined;
                if (!balanceData || !balanceData.total) return;
                
                for (const [asset, amount] of Object.entries(balanceData.total)) {
                  if (!amount || typeof amount !== 'number' || amount <= 0) continue;
                  
                  // Calculate USD value
                  const price = getCryptoPrice(asset);
                  const usdValue = amount * price;
                  
                  if (!assetTotals[asset]) {
                    assetTotals[asset] = { amount: 0, usdValue: 0 };
                  }
                  assetTotals[asset].amount += amount;
                  assetTotals[asset].usdValue += usdValue;
                }
              } catch {
                // ignore this bot on error
              }
            })
          );
          balances[exchange] = assetTotals;
        }

        setExchangeBalances(balances);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch balances');
      } finally {
        setLoading(false);
      }
    }
    fetchAllBalances();
  }, [bots]);

  if (loading) return <div className="flex items-center justify-center py-8 text-gray-500">Loading exchange balances...</div>;
  if (error) return <div className="text-red-500 text-center py-8">{error}</div>;

  return (
    <div className="flex flex-wrap gap-8 justify-center">
      {Object.entries(exchangeBalances).map(([exchange, assetBalances]) => {
        // Calculate total USD value
        const totalUsdValue = Object.values(assetBalances).reduce((sum, asset) => sum + asset.usdValue, 0);
        
        // Sort assets by USD value (descending)
        const sortedAssets = Object.entries(assetBalances).sort((a, b) => b[1].usdValue - a[1].usdValue);
        
        const labels = sortedAssets.map(([asset, data]) => {
          const percent = totalUsdValue > 0 ? ((data.usdValue / totalUsdValue) * 100).toFixed(2) : '0.00';
          const usdFormatted = data.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return `${asset}: $${usdFormatted} (${percent}%)`;
        });
        
        const dataValues = sortedAssets.map(([, data]) => data.usdValue);
        
        const data = {
          labels,
          datasets: [
            {
              data: dataValues,
              backgroundColor: [
                '#60a5fa', '#fbbf24', '#34d399', '#f87171', '#a78bfa', 
                '#f472b6', '#38bdf8', '#facc15', '#4ade80', '#fb7185',
              ],
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        };
        
        return (
          <div key={exchange} className="flex flex-col items-center">
            <h3 className="font-semibold mb-2 text-lg">
              {exchange.charAt(0).toUpperCase() + exchange.slice(1)}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Total: ${totalUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div style={{ width: 280, height: 280 }}>
              <Pie 
                data={data}
                options={{
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                          size: 11
                        }
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const label = context.label || '';
                          return label;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
} 
