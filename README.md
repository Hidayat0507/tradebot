This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# tradebot

## Documentation

See `docs/` for project docs:
- `docs/API.md`
- `docs/RULES.md`

## Billing & Subscriptions

The app now supports Stripe-based subscriptions:

- Free plan: up to 5 bots per user
- Pro plan ($5/mo): up to 25 bots per user
- Admin users (configured via email) have unlimited bots

### Environment variables

Add the following variables to your environment (e.g. `.env.local`):

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=https://your-domain.com
# Optional: comma-separated list of admin emails with unlimited bots
ADMIN_EMAILS=you@example.com,partner@example.com
```

### Database migration

Run the new Supabase migration to create the `user_subscriptions` table:

```
npm run migrate:custom
```

### Stripe webhook

Configure a Stripe webhook pointing to:

```
POST https://your-domain.com/api/stripe/webhook
```

Listen for the following events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.

### Managing subscriptions

Authenticated users can manage their plan from the **Billing** tab inside `/profile` (or directly via `/billing`). The create-bot flow enforces plan limits, and admins (by email) bypass all limits.
