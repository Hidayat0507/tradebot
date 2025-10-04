'use client'

import { createClient } from '@/utils/supabase/client'

type AuthResponse = 
  | { error: string; success?: never; message?: never }
  | { success: true; error?: never; message?: string }

export async function signInWithGoogle(): Promise<AuthResponse> {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function login(formData: FormData): Promise<AuthResponse> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Please provide both email and password' }
  }

  const supabase = createClient()

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
  const username = formData.get('username') as string

  if (!email || !password || !username) {
    return { error: 'Please provide all required fields' }
  }

  const supabase = createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
      data: {
        username: username,
        display_name: username,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { 
    success: true,
    message: 'Check your email for the confirmation link.'
  }
}
