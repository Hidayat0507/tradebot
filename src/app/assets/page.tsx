"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BotBalance } from '@/app/bots/components/bot-balance';
import { createClient } from '@/utils/supabase/client';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import ExchangePieChart from './components/exchange-pie-chart';
Chart.register(ArcElement, Tooltip, Legend);

interface Bot {
  id: string;
  name: string;
  exchange: string;
  pair: string;
}

export default function AssetsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchBots() {
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
    }
    fetchBots();
  }, [supabase]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              View your asset balances across all connected bots and exchanges.
            </p>
            {loading ? (
              <div>Loading bots...</div>
            ) : error ? (
              <div className="text-red-500">{error}</div>
            ) : bots.length === 0 ? (
              <div>No bots found.</div>
            ) : (
              <>
                <ExchangePieChart bots={bots} />
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bot Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Exchange</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pair</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {bots.map(bot => (
                        <tr key={bot.id}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{bot.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{bot.exchange}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{bot.pair}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            <BotBalance botId={bot.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
} 
