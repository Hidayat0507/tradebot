import { logger, normalizeError } from './logging';

interface NotificationOptions {
  title: string;
  description: string;
  color?: number; // Discord embed color
  fields?: Array<{ name: string; value: string }>;
}

export class NotificationService {
  private discordWebhookUrl: string;

  constructor() {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('DISCORD_WEBHOOK_URL is not configured');
    }
    this.discordWebhookUrl = webhookUrl;
  }

  async sendNotification(options: NotificationOptions) {
    try {
      const payload = {
        embeds: [{
          title: options.title,
          description: options.description,
          color: options.color || 0xFF0000, // Red by default
          fields: options.fields || [],
          timestamp: new Date().toISOString()
        }]
      };

      const response = await fetch(this.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.statusText}`);
      }
    } catch (error: unknown) {
      logger.error('Failed to send notification', normalizeError(error), {
        webhookUrl: this.discordWebhookUrl
      });
    }
  }

  // Trade execution errors
  async notifyTradeError(
    error: Error,
    tradeDetails: { symbol?: string; action?: string; price?: number }
  ) {
    await this.sendNotification({
      title: '❌ Trade Execution Failed',
      description: error.message,
      color: 0xFF0000, // Red
      fields: [
        { name: 'Symbol', value: tradeDetails.symbol || 'N/A' },
        { name: 'Action', value: tradeDetails.action || 'N/A' },
        { name: 'Price', value: tradeDetails.price?.toString() || 'N/A' }
      ]
    });
  }

  // Balance errors
  async notifyInsufficientBalance(details: { 
    required: number; 
    available: number; 
    symbol: string 
  }) {
    await this.sendNotification({
      title: '⚠️ Insufficient Balance',
      description: 'Unable to execute trade due to insufficient balance',
      color: 0xFFA500, // Orange
      fields: [
        { name: 'Symbol', value: details.symbol },
        { name: 'Required', value: details.required.toString() },
        { name: 'Available', value: details.available.toString() }
      ]
    });
  }

  // System errors
  async notifySystemError(error: Error) {
    await this.sendNotification({
      title: '🚨 System Error',
      description: error.message,
      color: 0x8B0000, // Dark Red
    });
  }
}

// Export singleton instance
export const notifications = new NotificationService();
