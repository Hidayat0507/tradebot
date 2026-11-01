import Link from 'next/link'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmptyState({ title, description, createBot = false, children }: {
  title: string
  description: string
  createBot?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-10 text-center dark:border-gray-700 dark:bg-gray-800/70">
      <Bot aria-hidden className="mx-auto mb-4 h-10 w-10 text-blue-500" />
      <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      <p className="mx-auto mb-4 max-w-lg text-sm text-gray-600 dark:text-gray-300">{description}</p>
      {children}
      {createBot && <Button asChild variant="gradient"><Link href="/bots/create">Create your first bot</Link></Button>}
    </div>
  )
}
