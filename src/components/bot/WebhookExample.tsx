'use client'

import { useEffect, useState } from 'react'
import { CopyButton } from '@/components/ui/copy-button'
import { buildAlertExampleJson, currentOrigin, webhookUrl, WEBHOOK_FIELDS } from '@/lib/webhook-example'

/** TradingView setup built from the real webhook contract and this deployment's origin. */
export function WebhookExample({ botId, pair, secret, orderSizePct }: { botId?: string; pair?: string; secret?: string; orderSizePct?: number }) {
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(currentOrigin()), [])
  const url = origin ? webhookUrl(origin) : ''
  const json = buildAlertExampleJson({ origin, botId, pair, secret, orderSizePct })
  return (
    <div className="space-y-5 text-sm">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-medium text-gray-100">1. Webhook URL</h4>
          {url && <CopyButton value={url} />}
        </div>
        <code className="block rounded-md border border-gray-700 bg-gray-900 p-2 text-gray-100" data-testid="webhook-url">{url || '…'}</code>
        <p className="mt-1 text-gray-400">In TradingView: Alert → Notifications → Webhook URL.</p>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-medium text-gray-100">2. Alert message</h4>
          <CopyButton value={json} />
        </div>
        <pre className="overflow-x-auto rounded-md border border-gray-700 bg-gray-900 p-3 text-xs text-gray-100" data-testid="alert-example">{json}</pre>
        {!secret && <p className="mt-1 text-amber-300">Replace YOUR_WEBHOOK_SECRET with your secret.</p>}
      </div>
      <div>
        <h4 className="mb-1 font-medium text-gray-100">Fields</h4>
        <ul className="space-y-1 text-gray-300">
          {WEBHOOK_FIELDS.map((f) => (
            <li key={f.name}><code className="text-blue-300">{f.name}</code>{f.required ? '' : ' (optional)'} — {f.description}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
