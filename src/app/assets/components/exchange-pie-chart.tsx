import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import * as ccxt from 'ccxt';
import { createClient } from '@/utils/supabase/client';
Chart.register(ArcElement, Tooltip, Legend);

interface Bot {
  id: string;
  name: string;
  exchange: string;
  api_key: string;
  api_secret: string;
}

interface AssetBalance {
  [asset: string]: number;
}

interface ExchangeBalances {
  [exchange: string]: AssetBalance;
}

export default function ExchangePieChart() {
  const [exchangeBalances, setExchangeBalances] = useState<ExchangeBalances>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchAllBalances() {
      setLoading(true);
      setError(null);
      try {
        // Fetch all bots with credentials
        const { data: bots, error: botsError } = await supabase
          .from('bots')
          .select('id, name, exchange, api_key, api_secret');
        if (botsError) throw botsError;
        if (!bots) return;

        // Group bots by exchange
        const grouped: Record<string, Bot[]> = {};
        bots.forEach((bot: Bot) => {
          if (!grouped[bot.exchange]) grouped[bot.exchange] = [];
          grouped[bot.exchange].push(bot);
        });

        // For each exchange, fetch and aggregate balances
        const balances: ExchangeBalances = {};
        for (const [exchange, bots] of Object.entries(grouped)) {
          const assetTotals: AssetBalance = {};
          for (const bot of bots) {
            try {
              const ExchangeClass = (ccxt as any)[exchange.toLowerCase()];
              if (!ExchangeClass) continue;
              const exchangeInstance = new ExchangeClass({
                apiKey: bot.api_key,
                secret: bot.api_secret,
              });
              let rawBalance;
              try {
                rawBalance = await exchangeInstance.fetchBalance();
              } catch {
                // Try with spot type if normal fails
                try {
                  rawBalance = await exchangeInstance.fetchBalance({ type: 'spot' });
                } catch {
                  continue;
                }
              }
              if (rawBalance && rawBalance.total) {
                for (const [asset, amount] of Object.entries(rawBalance.total)) {
                  if (!amount || typeof amount !== 'number' || amount <= 0) continue;
                  assetTotals[asset] = (assetTotals[asset] || 0) + amount;
                }
              }
            } catch {
              continue;
            }
          }
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
  }, [supabase]);

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
