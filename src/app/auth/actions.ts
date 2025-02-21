'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'

type AuthResponse = 
  | { error: string; success?: never; message?: never }
  | { success: true; error?: never; message?: string }

export async function login(formData: FormData): Promise<AuthResponse> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Please provide both email and password' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function signup(formData: FormData): Promise<AuthResponse> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Please provide both email and password' }
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
    return { error: error.message }
  }

  return { success: true, message: 'Check your email for the confirmation link.' }
}
