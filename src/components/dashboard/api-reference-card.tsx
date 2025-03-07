import React from 'react';

const ApiReferenceCard: React.FC = () => {
  return (
    <div className="api-reference-card">
      <h2>Trading Bot API</h2>
      <p><strong>Endpoint:</strong> POST /api/webhook</p>
      <p><strong>Key Parameters:</strong></p>
      <ul>
        <li><strong>bot_id:</strong> Bot's ID</li>
        <li><strong>symbol:</strong> Trading pair</li>
        <li><strong>action:</strong> "BUY" or "SELL"</li>
        <li><strong>secret:</strong> Webhook secret</li>
      </ul>
      <p><strong>Example Payload:</strong></p>
      <pre>{`{
  "bot_id": "123",
  "symbol": "BTC/USDC",
  "action": "BUY",
  "secret": "your_secret"
}`}</pre>
      <p>See <a href="./API.md">API Documentation</a> for more.</p>
    </div>
  );
};

export default ApiReferenceCard; 