'use client'

import { login, signup, signInWithGoogle } from './actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Suspense } from 'react'
import Link from 'next/link'

const authSchema = z.object({
  username: z.string().optional(),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().optional(),
})

type AuthFormValues = z.infer<typeof authSchema>

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data: AuthFormValues) => {
    setError(null)
    setMessage(null)

    // Validation for signup
    if (!isLogin) {
      if (!data.username || data.username.length < 3) {
        setError('Username must be at least 3 characters')
        return
      }
      if (!data.confirmPassword) {
        setError('Please confirm your password')
        return
      }
      if (data.password !== data.confirmPassword) {
        setError("Passwords don't match")
        return
      }
    }

    const formData = new FormData()
    formData.append('email', data.email)
    formData.append('password', data.password)
    
    if (!isLogin && data.username) {
      formData.append('username', data.username)
    }

    const result = await (isLogin ? login(formData) : signup(formData))

    if (result.error) {
      setError(result.error)
    } else if (result.success) {
      if (result.message) {
        setMessage(result.message)
      }
      if (isLogin) {
        router.push('/dashboard')
        router.refresh()
      }
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setMessage(null)
    
    const result = await signInWithGoogle()
    
    if (result.error) {
      setError(result.error)
    }
    // Success case will redirect automatically
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left Side - Branding & Features */}
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-12 text-white">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-500/10 to-transparent blur-3xl" aria-hidden="true" />
          <div className="absolute -right-1/4 -top-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-1/4 -left-1/4 h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-3xl" />
          
          <div className="relative z-10">
            <Link href="/" className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Trading Bot
            </Link>
            <p className="mt-4 text-lg text-white/70">
              Automate your crypto trading with TradingView signals
            </p>
          </div>

          <div className="relative z-10 space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-6">Why traders choose us</h2>
              <div className="space-y-6">
                {[
                  {
                    icon: '⚡',
                    title: 'Lightning Fast Execution',
                    description: 'Execute trades in milliseconds with our optimized infrastructure'
                  },
                  {
                    icon: '🔒',
                    title: 'Bank-Level Security',
                    description: 'Your API keys are encrypted and never leave our secure servers'
                  },
                  {
                    icon: '📊',
                    title: 'Real-Time Analytics',
                    description: 'Monitor your bots performance with detailed insights and metrics'
                  },
                  {
                    icon: '🤖',
                    title: 'Smart Automation',
                    description: 'Set it and forget it - let your strategy run 24/7'
                  },
                ].map((feature, index) => (
                  <div key={index} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl border border-white/20">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                      <p className="text-white/70 text-sm">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-8 text-sm text-white/60">
              <span>2,500+ Active Bots</span>
              <span>•</span>
              <span>$10M+ Trading Volume</span>
              <span>•</span>
              <span>99.9% Uptime</span>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="flex items-center justify-center p-8 bg-white dark:bg-slate-950">
          <div className="w-full max-w-md space-y-8">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center">
              <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Trading Bot
              </Link>
            </div>

            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold tracking-tight">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                {isLogin 
                  ? 'Sign in to access your trading bots' 
                  : 'Start automating your trading in minutes'}
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {message && (
              <Alert className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {/* Google Sign In */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              className="w-full h-12 text-base font-medium border-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm uppercase">
                <span className="bg-white dark:bg-slate-950 px-2 text-gray-500">
                  Or continue with email
                </span>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {!isLogin && (
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Username</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="johndoe" 
                            className="h-12 text-base"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Email address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="name@example.com" 
                          className="h-12 text-base"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter your password"
                          className="h-12 text-base"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!isLogin && (
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Confirm Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Confirm your password"
                            className="h-12 text-base"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting 
                    ? 'Please wait...' 
                    : isLogin ? 'Sign In' : 'Create Account'}
                </Button>
              </form>
            </Form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-950 px-2 text-gray-500">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setIsLogin(!isLogin)
                setError(null)
                setMessage(null)
                form.reset()
              }}
              className="w-full h-12 text-base font-semibold border-2"
            >
              {isLogin ? 'Create a new account' : 'Sign in to existing account'}
            </Button>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="underline hover:text-gray-900 dark:hover:text-gray-100">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline hover:text-gray-900 dark:hover:text-gray-100">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Suspense>
  )
}
