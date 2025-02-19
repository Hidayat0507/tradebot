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
    <div className="container space-y-8 py-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Trading Dashboard</h1>
        <Button>
          <Link href="/bots/create">Create Bot</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Active Positions" value="0" />
        <StatsCard title="24h Profit/Loss" value="$0.00" />
        <StatsCard title="Total Trades" value="0" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Positions</CardTitle>
            <CardDescription>Your current open trading positions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              No active positions
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Trades</CardTitle>
            <CardDescription>Your latest completed trades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              No recent trades
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
