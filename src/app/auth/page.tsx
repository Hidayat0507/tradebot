'use client'

import { login, signup } from './actions'
import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

function SearchParamsContent() {
  const searchParams = useSearchParams()
  const errorMessage = searchParams.get('error')
  const successMessage = searchParams.get('message')

  return (
    <>
      {errorMessage && (
        <div className="mb-4 p-4 text-sm text-red-800 bg-red-100 rounded-lg dark:bg-red-800/20 dark:text-red-400" role="alert">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 text-sm text-green-800 bg-green-100 rounded-lg dark:bg-green-800/20 dark:text-green-400" role="alert">
          {successMessage}
        </div>
      )}
    </>
  )
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2 bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Trading Bot
        </h1>

        <Suspense fallback={null}>
          <SearchParamsContent />
        </Suspense>

        <form action={isLogin ? login : signup} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
