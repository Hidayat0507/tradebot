# Admin Panel Guide

## Overview

The admin panel allows administrators to manage users, view platform statistics, and control subscription limits for individual users.

## Accessing the Admin Panel

1. **Set Admin Email:** Add your email to `.env.local`:
   ```
   ADMIN_EMAILS=your-email@example.com,another-admin@example.com
   ```

2. **Access URL:** Once logged in as an admin, visit: `/admin`

3. **Navigation:** The "Admin" link will appear in the navbar automatically for admin users

## Features

### 📊 Dashboard Statistics

The admin panel displays key metrics:
- **Total Users:** Number of registered users
- **Total Bots:** All bots created across the platform
- **Active Subscriptions:** Users with active paid plans
- **MRR (Monthly Recurring Revenue):** Calculated based on active pro subscriptions

### 👥 User Management

View and manage all users in a table format:

| Column | Description |
|--------|-------------|
| **Email** | User's email address |
| **Plan** | Current subscription plan (free/pro/admin) |
| **Status** | Subscription status (active/inactive/cancelled) |
| **Bots** | Number of bots user has created |
| **Max Bots** | Custom bot limit (overrides plan defaults) |
| **Member Since** | User registration date |

### ⚙️ User Actions

**Edit User:**
1. Click "Edit" on any user row
2. Modify:
   - **Plan:** Select free, pro, or admin
   - **Status:** Set to active, inactive, or cancelled  
   - **Max Bots:** Set custom limit (empty = use plan default)
3. Click "Save" to apply changes

**Delete Subscription:**
- Click the trash icon to remove a user's subscription
- User will revert to free tier defaults

## Plan Limits

Default limits are defined in `src/lib/subscriptions.ts`:

```typescript
export const FREE_PLAN_MAX_BOTS = 5
export const PRO_PLAN_MAX_BOTS = 25
```

**How It Works:**
1. **Free Users:** Get `FREE_PLAN_MAX_BOTS` bots (currently 5)
2. **Pro Users:** Get `PRO_PLAN_MAX_BOTS` bots (currently 25)
3. **Custom Limit:** Admin can override per-user via "Max Bots" field
4. **Admin Users:** Unlimited bots (no restrictions)

## API Endpoints

The admin panel uses these protected endpoints:

- `GET /api/admin/users` - List all users with their subscriptions
- `GET /api/admin/stats` - Get platform statistics
- `PATCH /api/admin/users/[id]` - Update user subscription/limits
- `DELETE /api/admin/users/[id]/subscription` - Delete user subscription

**Security:** All endpoints verify the requesting user is an admin using `isAdminUser()`

## Use Cases

### Scenario 1: Grant Beta Access
User wants early access to test your platform:
1. Find user in admin panel
2. Click "Edit"
3. Set "Max Bots" to 10 (or any number)
4. Set "Status" to active
5. Save

### Scenario 2: Upgrade User to Admin
Promote a team member:
1. Find user in admin panel  
2. Click "Edit"
3. Set "Plan" to "admin"
4. Save
5. User now has unlimited bots + admin panel access

### Scenario 3: Custom Enterprise Plan
Create custom limits for enterprise customer:
1. Find user in admin panel
2. Click "Edit"
3. Set "Plan" to "pro"
4. Set "Max Bots" to 100 (custom limit)
5. Save

### Scenario 4: Revoke Access
Suspend problematic user:
1. Find user in admin panel
2. Click "Edit"
3. Set "Status" to "cancelled"
4. Set "Max Bots" to 0
5. Save

## Changing Global Limits

To change default limits for all users:

1. Edit `src/lib/subscriptions.ts`:
   ```typescript
   export const FREE_PLAN_MAX_BOTS = 10  // Change from 5
   export const PRO_PLAN_MAX_BOTS = 50   // Change from 25
   ```

2. Rebuild and deploy:
   ```bash
   bun run build
   vercel --prod
   ```

3. Changes apply to all new and existing users (unless they have custom limits)

## Security

**Admin Authentication:**
- Only users with emails in `ADMIN_EMAILS` env variable can access
- All API requests verify admin status
- Non-admins get 403 Forbidden error

**Best Practices:**
- ✅ Use strong passwords for admin accounts
- ✅ Enable 2FA on admin email accounts
- ✅ Keep `ADMIN_EMAILS` list minimal
- ✅ Use work/business emails only
- ✅ Review admin access regularly

## Troubleshooting

**"Admin" link not showing?**
- Check `ADMIN_EMAILS` in `.env.local`
- Verify your login email matches exactly
- Restart dev server after changing `.env.local`

**403 Forbidden when accessing /admin?**
- Ensure you're logged in
- Verify your email is in `ADMIN_EMAILS`
- Check for typos in email addresses

**User limits not updating?**
- Click "Save" after editing
- Check browser console for errors
- Verify Supabase connection

## Future Enhancements

Potential features to add:
- [ ] Bulk user actions
- [ ] User search/filter
- [ ] Export user data to CSV
- [ ] Subscription analytics charts
- [ ] Email notifications for admin actions
- [ ] Audit log for admin changes
- [ ] Custom pricing plans beyond free/pro

---

**Need Help?** Check the main README or contact the development team.

