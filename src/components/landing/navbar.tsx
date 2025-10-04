import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LandingNavbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link 
          href="/"
          className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
        >
          Trading Bot
        </Link>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="text-white hover:text-white hover:bg-white/10">
            <Link href="/auth">Sign In</Link>
          </Button>
          <Button size="sm" asChild className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <Link href="/auth">Get Started</Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}



