import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey)
  }

  return stripeClient
}

export function getStripePriceId() {
  const priceId = process.env.STRIPE_PRICE_ID

  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID is not configured')
  }

  return priceId
}

export function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL

  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL (or SITE_URL) is not configured')
  }

  return siteUrl.replace(/\/$/, '')
}
