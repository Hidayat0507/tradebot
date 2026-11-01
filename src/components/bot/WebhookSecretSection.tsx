"use client"

import { friendlyError, requestFailure } from '@/lib/friendly-error';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { secretDisplay } from '@/lib/webhook-secret-display';

interface WebhookSecretSectionProps {
  bot: { id: string; webhook_secret?: string | null };
  /** plaintext returned by the last regenerate in this session (shown once) */
  freshSecret: string | null;
  onSecretRegenerated: (secret: string) => void;
}

export function WebhookSecretSection({ bot, freshSecret, onSecretRegenerated }: WebhookSecretSectionProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const display = secretDisplay(bot.webhook_secret, freshSecret);

  const regenerate = async () => {
    setConfirming(false);
    try {
      setIsRegenerating(true);
      const response = await fetch(`/api/bots/${bot.id}/webhook-secret`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      });
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok || !responseData.data?.webhook_secret) {
        throw requestFailure(response.status);
      }
      onSecretRegenerated(responseData.data.webhook_secret);
      setCopied(false);
      toast({ title: 'New secret generated', description: 'Copy it now and update your TradingView alerts. It will not be shown again.' });
    } catch (error) {
      toast({ title: 'Could not generate secret', description: friendlyError(error, 'We could not generate a new secret. Please try again.'), variant: 'destructive' });
    } finally {
      setIsRegenerating(false);
    }
  };

  const copy = async () => {
    if (display.kind !== 'fresh') return;
    await navigator.clipboard.writeText(display.value);
    setCopied(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook Secret</CardTitle>
        <CardDescription>
          TradingView sends this in the <code>secret</code> field of every alert. It is stored hashed, so it can only be shown once — right after you generate it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {display.kind === 'fresh' ? (
          <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3" data-testid="secret-fresh">
            <Label htmlFor="webhook-secret">Your new secret — copy it now</Label>
            <div className="flex gap-2">
              <Input id="webhook-secret" value={display.value} readOnly className="font-mono" onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={copy} aria-label="Copy webhook secret">{copied ? 'Copied' : 'Copy'}</Button>
            </div>
            <p className="text-sm text-amber-200">
              This is the only time it is shown. Your old secret no longer works — update the alert message in TradingView.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-300" data-testid="secret-hidden">
            {display.kind === 'hidden'
              ? 'A secret is set but hidden for security. Lost it? Generate a new one below.'
              : 'No secret yet. Generate one to start receiving alerts.'}
          </div>
        )}

        {confirming ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-300">The current secret will stop working immediately.</span>
            <Button variant="destructive" onClick={regenerate} disabled={isRegenerating}>Yes, generate new secret</Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => (display.kind === 'missing' ? regenerate() : setConfirming(true))}
            disabled={isRegenerating || !bot.id}
          >
            {isRegenerating ? 'Generating…' : display.kind === 'missing' ? 'Generate secret' : 'Generate new secret'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
