"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Bot } from '@/types';

interface WebhookSecretSectionProps {
  bot: Bot;
  onSecretRegenerated: (secret: string) => void;
}

export function WebhookSecretSection({ bot, onSecretRegenerated }: WebhookSecretSectionProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerateClick = async () => {
    if (!bot.id) {
      toast({
        title: 'Error',
        description: 'Bot ID is missing',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsRegenerating(true);
      
      const response = await fetch(`/api/bots/${bot.id}/webhook-secret`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Server error details:', responseData);
        throw new Error(
          responseData.error || 
          `Failed to regenerate webhook secret (${response.status})`
        );
      }

      if (!responseData.success || !responseData.data?.webhook_secret) {
        throw new Error('No webhook secret received from server');
      }

      onSecretRegenerated(responseData.data.webhook_secret);
      toast({
        title: 'Success',
        description: 'Webhook secret has been regenerated',
      });
    } catch (error) {
      console.error('Failed to regenerate webhook secret:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyClick = () => {
    if (!bot.webhook_secret) {
      toast({
        title: 'Error',
        description: 'No webhook secret available to copy',
        variant: 'destructive',
      });
      return;
    }

    navigator.clipboard.writeText(bot.webhook_secret);
    toast({
      title: 'Copied',
      description: 'Webhook secret copied to clipboard',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook Secret</CardTitle>
        <CardDescription>
          Use this secret to authenticate webhook requests from TradingView
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="webhook-secret">Current Secret</Label>
          <div className="flex space-x-2">
            <Input
              id="webhook-secret"
              value={bot.webhook_secret || ''}
              readOnly
              type="text"
              className="font-mono"
              placeholder="No webhook secret available"
            />
            <Button
              variant="ghost"
              onClick={handleCopyClick}
              disabled={!bot.webhook_secret}
            >
              Copy
            </Button>
          </div>
        </div>
        
        <Button
          variant="secondary"
          onClick={handleRegenerateClick}
          disabled={isRegenerating || !bot.id}
        >
          {isRegenerating ? 'Regenerating...' : 'Regenerate Secret'}
        </Button>
        
        {/* Example removed here to avoid duplication. See the Webhook Configuration card above for the single TradingView example. */}
      </CardContent>
    </Card>
  );
}
