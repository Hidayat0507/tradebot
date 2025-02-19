'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return redirect('/auth?error=Please provide both email and password')
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect('/auth?error=' + error.message)
  }

  return redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return redirect('/auth?error=Please provide both email and password')
  }

  // Get the site URL from headers as fallback
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    return redirect('/auth?error=' + error.message)
  }

  return redirect('/auth?message=Check your email to continue sign in process')
}
