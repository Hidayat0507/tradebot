'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from "@/components/ui/button"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useState, useEffect } from 'react'

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const pathname = usePathname()
  const isActive = pathname === href || pathname?.startsWith(href + '/')
  
  return (
    <Link
      href={href}
      className={cn(
        "relative px-4 py-2 text-sm font-medium transition-all rounded-lg",
        "hover:bg-gray-100 dark:hover:bg-gray-800",
        isActive ? 
          "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : 
          "text-gray-600 dark:text-gray-400"
      )}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full" />
      )}
    </Link>
  )
}

export default function Navigation() {
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link 
            href="/"
            className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            Trading Bot
          </Link>
          
          <div className="flex items-center gap-2">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/bots">Bots</NavLink>
            <NavLink href="/settings">Settings</NavLink>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <Button variant="default" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          ) : (
            <Button variant="default" size="sm">
              <Link href="/auth">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
