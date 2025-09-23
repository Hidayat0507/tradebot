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
  [asset: string]: number;
}

interface ExchangeBalances {
  [exchange: string]: AssetBalance;
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
          const assetTotals: AssetBalance = {};
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
                  assetTotals[asset] = (assetTotals[asset] || 0) + amount;
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

  if (loading) return <div>Loading exchange balances...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="mb-8 flex flex-wrap gap-8">
      {Object.entries(exchangeBalances).map(([exchange, assetBalances]) => {
        const total = Object.values(assetBalances).reduce((a, b) => a + b, 0);
        const labels = Object.keys(assetBalances);
        const dataValues = Object.values(assetBalances);
        const data = {
          labels: labels.map((asset) => {
            const amount = assetBalances[asset];
            const percent = total > 0 ? ((amount / total) * 100).toFixed(2) : '0.00';
            return `${asset}: ${amount} (${percent}%)`;
          }),
          datasets: [
            {
              data: dataValues,
              backgroundColor: [
                '#60a5fa', '#fbbf24', '#34d399', '#f87171', '#a78bfa', '#f472b6', '#38bdf8', '#facc15', '#4ade80', '#fb7185',
              ],
            },
          ],
        };
        return (
          <div key={exchange} className="flex flex-col items-center">
            <h3 className="font-semibold mb-2">{exchange} (Total: {total})</h3>
            <div style={{ width: 260, height: 260 }}>
              <Pie data={data} />
            </div>
          </div>
        );
      })}
    </div>
  );
} 
