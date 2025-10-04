'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, Trash2, Users, Bot, DollarSign } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UserData {
  id: string
  email: string
  created_at: string
  bot_count: number
  subscription: {
    plan: string
    status: string
    max_bots: number | null
    current_period_end: string | null
  } | null
}

interface Stats {
  totalUsers: number
  totalBots: number
  activeSubscriptions: number
  revenue: number
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{
    plan: string
    max_bots: string
    status: string
  }>({ plan: '', max_bots: '', status: '' })

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [usersRes, statsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/stats'),
      ])

      if (!usersRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch admin data')
      }

      const usersData = await usersRes.json()
      const statsData = await statsRes.json()

      setUsers(usersData.users || [])
      setStats(statsData.stats || null)
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const startEditing = (user: UserData) => {
    setEditingUser(user.id)
    setEditValues({
      plan: user.subscription?.plan || 'free',
      max_bots: user.subscription?.max_bots?.toString() || '',
      status: user.subscription?.status || 'inactive',
    })
  }

  const cancelEditing = () => {
    setEditingUser(null)
    setEditValues({ plan: '', max_bots: '', status: '' })
  }

  const saveUser = async (userId: string) => {
    try {
      setError(null)
      setSuccess(null)

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: editValues.plan,
          max_bots: editValues.max_bots ? parseInt(editValues.max_bots) : null,
          status: editValues.status,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update user')
      }

      setSuccess('User updated successfully')
      setEditingUser(null)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const deleteSubscription = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user\'s subscription?')) {
      return
    }

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete subscription')
      }

      setSuccess('Subscription deleted successfully')
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage users, subscriptions, and platform settings</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bots</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBots}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.revenue}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View and manage all users and their subscription limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bots</TableHead>
                  <TableHead>Max Bots</TableHead>
                  <TableHead>Member Since</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        {editingUser === user.id ? (
                          <Select
                            value={editValues.plan}
                            onValueChange={(value) =>
                              setEditValues({ ...editValues, plan: value })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="capitalize">{user.subscription?.plan || 'free'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingUser === user.id ? (
                          <Select
                            value={editValues.status}
                            onValueChange={(value) =>
                              setEditValues({ ...editValues, status: value })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="capitalize">{user.subscription?.status || 'inactive'}</span>
                        )}
                      </TableCell>
                      <TableCell>{user.bot_count}</TableCell>
                      <TableCell>
                        {editingUser === user.id ? (
                          <Input
                            type="number"
                            value={editValues.max_bots}
                            onChange={(e) =>
                              setEditValues({ ...editValues, max_bots: e.target.value })
                            }
                            placeholder="Unlimited"
                            className="w-24"
                          />
                        ) : (
                          user.subscription?.max_bots || 'Default'
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {editingUser === user.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => saveUser(user.id)}
                              className="mr-2"
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(user)}
                            >
                              Edit
                            </Button>
                            {user.subscription && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteSubscription(user.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

