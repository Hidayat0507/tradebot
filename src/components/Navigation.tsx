'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from "@/components/ui/button"
import { createClient } from '@/utils/supabase/client'
import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import ProfileMenu from './profile-menu'
import { APP_NAME } from '@/lib/format'
import { Menu, X } from 'lucide-react'

const NavLink = ({ href, children, onClick, block }: { href: string; children: React.ReactNode; onClick?: () => void; block?: boolean }) => {
  const pathname = usePathname()
  const isActive = pathname === href || pathname?.startsWith(href + '/')
  
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        block ? "block" : "",
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
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        router.refresh()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const links = (
    block: boolean,
  ) => (
    <>
      <NavLink block={block} href="/dashboard">Dashboard</NavLink>
      <NavLink block={block} href="/bots">Bots</NavLink>
      <NavLink block={block} href="/strategy">Strategies</NavLink>
      <NavLink block={block} href="/assets">Assets</NavLink>
      {user && isAdmin && <NavLink block={block} href="/admin">Admin</NavLink>}
    </>
  )
  useEffect(() => {
    let active = true
    setIsAdmin(false)
    if (user) fetch('/api/subscription').then(res => res.ok ? res.json() : null)
      .then(result => { if (active) setIsAdmin(result?.data?.plan === 'admin') })
      .catch(() => { if (active) setIsAdmin(false) })
    return () => { active = false }
  }, [user])

  return (
    <nav aria-label="Main" className="sticky top-0 z-40 w-full border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl">
      <div className="container flex h-14 md:h-16 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            href="/"
            className="whitespace-nowrap text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            {APP_NAME}
          </Link>
          <div className="hidden md:flex items-center gap-2">{links(false)}</div>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <ProfileMenu user={user} />
          ) : (
            <Button variant="default" size="sm" asChild>
              <Link href="/auth">Sign In</Link>
            </Button>
          )}
          <button
            type="button"
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-nav" className="md:hidden border-t border-gray-200 dark:border-gray-800 px-4 py-2 space-y-1">
          {links(true)}
        </div>
      )}
    </nav>
  )
}
