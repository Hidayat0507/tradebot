'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    const supabase = createClient()

    // Get initial user state
    const initializeAuth = async () => {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser()
        if (error) throw error
        setUser(currentUser)
      } catch (error) {
        console.error('Error getting user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)

      // Force router refresh to update all components
      if (event === 'SIGNED_IN') {
        router.push('/dashboard')
        router.refresh()
      } else if (event === 'SIGNED_OUT') {
        router.push('/auth')
        router.refresh()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  if (isLoading) {
    return null // or a loading spinner
  }

  return <>{children}</>
}
