import Link from "next/link"
import { StatsCard } from "@/components/dashboard/stats-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Trading Dashboard</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Monitor your trading performance and manage your bots</p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            <StatsCard 
              title="Active Positions" 
              value="0" 
              className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            />
            <StatsCard 
              title="24h Profit/Loss" 
              value="$0.00" 
              className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            />
            <StatsCard 
              title="Total Trades" 
              value="0" 
              className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            />
          </div>

          <div className="mt-8 grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Active Positions
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Your current open trading positions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-32 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-800 dark:text-gray-200">No active positions</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Recent Trades
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Your latest completed trades</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-32 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-800 dark:text-gray-200">No recent trades</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="gradient">
              <Link href="/bots/create">Create Bot</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
