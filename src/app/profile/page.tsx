'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"

const profileFormSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
})

const passwordFormSchema = z.object({
  currentPassword: z.string().min(6, 'Password must be at least 6 characters'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type ProfileFormValues = z.infer<typeof profileFormSchema>
type PasswordFormValues = z.infer<typeof passwordFormSchema>

export default function ProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [initialValues, setInitialValues] = useState<ProfileFormValues>({
    username: '',
    email: '',
  })

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: initialValues
  })

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
  })

  useEffect(() => {
    let isMounted = true

    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && isMounted) {
        const values = {
          username: user.user_metadata?.username || '',
          email: user.email || '',
        }
        setInitialValues(values)
        profileForm.reset(values)
      }
    }

    loadUserData()

    return () => {
      isMounted = false
    }
  }, [profileForm, supabase])

  const onProfileSubmit = async (data: ProfileFormValues) => {
    try {
      const { error } = await supabase.auth.updateUser({
        email: data.email,
        data: { username: data.username }
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Profile updated successfully' })
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update profile'
      setMessage({ type: 'error', text: message })
    }
  }

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    try {
      // First verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profileForm.getValues('email'),
        password: data.currentPassword,
      })

      if (signInError) {
        setMessage({ type: 'error', text: 'Current password is incorrect' })
        return
      }

      // Then update to new password
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Password updated successfully' })
      passwordForm.reset()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update password'
      setMessage({ type: 'error', text: message })
    }
  }

  return (
    <div className="container py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Profile Settings</h1>
          <p className="text-[0.9rem] text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        {message && (
          <Alert 
            className={message.type === 'success' 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-destructive text-destructive-foreground'
            }
          >
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl">Profile Information</CardTitle>
                <CardDescription>
                  Update your profile information and email address
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                    <FormField
                      control={profileForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input className="max-w-md" placeholder="Your username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input className="max-w-md" type="email" placeholder="Your email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-4">
                      <Button type="submit">
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl">Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input className="max-w-md" type="password" placeholder="Enter current password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input className="max-w-md" type="password" placeholder="Enter new password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input className="max-w-md" type="password" placeholder="Confirm new password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-4">
                      <Button type="submit">
                        Update Password
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
