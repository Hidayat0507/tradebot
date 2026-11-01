import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface StatsCardProps {
  title: string
  value: string
  description?: string
  className?: string
}

export function StatsCard({ title, value, description, className }: StatsCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2">
        <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        <div className="text-lg md:text-2xl font-bold break-words text-gray-900 dark:text-white">{value}</div>
        {description && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{description}</p>}
      </CardContent>
    </Card>
  )
}
