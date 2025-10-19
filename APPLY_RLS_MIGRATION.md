# Apply RLS Policies Migration

## Issue
You're encountering this error when creating bots:
```
Error creating bot: Error: Failed to create bot: new row violates row-level security policy for table "bots"
```

This occurs because the `bots` table has Row-Level Security (RLS) enabled, but there are no policies allowing users to insert, update, or delete their own bots.

## Solution
Apply the RLS policies migration that has been created for you.

## Steps to Apply Migration

### Option 1: Supabase Dashboard (Recommended)

1. **Open your Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sign in to your account
   - Select your project

2. **Navigate to SQL Editor**
   - Click on the "SQL Editor" option in the left sidebar
   - Or go directly to: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql`

3. **Create a New Query**
   - Click "New Query" button

4. **Copy the Migration SQL**
   - Open the file: `supabase/migrations/20250217120000_add_bots_rls_policies.sql`
   - Copy all the contents

5. **Paste and Run**
   - Paste the SQL into the query editor
   - Click "Run" or press `Ctrl/Cmd + Enter`

6. **Verify Success**
   - You should see a success message
   - The policies should now be applied

### Option 2: Using Supabase CLI (If installed)

If you have the Supabase CLI installed:

```bash
# Initialize Supabase in your project (if not already done)
supabase init

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push the migration
supabase db push
```

## What the Migration Does

The migration adds RLS policies to allow users to:

### For `bots` table:
- ✅ View their own bots
- ✅ Create their own bots
- ✅ Update their own bots
- ✅ Delete their own bots

### For `trades` table:
- ✅ View their own trades
- ✅ Create their own trades
- ✅ Update their own trades

### For `logs` table:
- ✅ View their own logs
- ✅ Create their own logs

### For `exchange_config` table:
- ✅ Full CRUD operations on their own configs

## After Migration

Once the migration is applied:
1. Try creating a bot again
2. The RLS error should be gone
3. Your bot should be created successfully

## Troubleshooting

### Still Getting Errors?
1. Make sure you're logged in (check authentication)
2. Verify the migration was applied successfully
3. Check the Supabase logs for any errors
4. Ensure your `user_id` matches the authenticated user's ID

### Need to Rollback?
If you need to remove the policies:

```sql
-- Run this in the SQL Editor
DROP POLICY IF EXISTS "Users can view own bots" ON public.bots;
DROP POLICY IF EXISTS "Users can insert own bots" ON public.bots;
DROP POLICY IF EXISTS "Users can update own bots" ON public.bots;
DROP POLICY IF EXISTS "Users can delete own bots" ON public.bots;
-- Repeat for other tables if needed
```

## Additional Resources
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase SQL Editor Guide](https://supabase.com/docs/guides/database/overview#sql-editor)

