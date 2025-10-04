'use client'

import { usePathname } from 'next/navigation'
import Navigation from './Navigation'

export default function ConditionalNavigation() {
  const pathname = usePathname()
  
  // Don't show navigation on landing page or auth pages
  if (pathname === '/' || pathname === '/auth' || pathname?.startsWith('/auth/')) {
    return null
  }
  
  return <Navigation />
}

