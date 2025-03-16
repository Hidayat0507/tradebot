export interface WebhookAlert {
  bot_id: string;
  symbol: string;
  action: 'buy' | 'sell';
  price?: number;
  strategy?: string;
  stoplossPercent?: number;
  secret?: string;
  amount?: number;
  order_size?: number;
} 