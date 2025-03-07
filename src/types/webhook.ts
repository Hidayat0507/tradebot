export interface WebhookAlert {
  bot_id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  price?: number;
  strategy?: string;
  stoplossPercent?: number;
  secret?: string;
  amount?: number;
  order_size?: number;
} 