# WebSocket Streaming

Real-time data streaming with the Limitless Exchange WebSocket API.

## Table of Contents

- [Overview](#overview)
- [Connection Setup](#connection-setup)
- [Subscription Types](#subscription-types)
- [Event Handling](#event-handling)
- [Best Practices](#best-practices)

## Overview

The Limitless Exchange WebSocket API provides real-time streaming for:

- **Market Prices**: Live orderbook updates and price changes
- **Positions**: Real-time position updates for authenticated users
- **Transactions**: Live order fills and transaction notifications

**Key Characteristics**:
- SDK is a **raw data passthrough** - no transformations
- Events use exact API event names (e.g., `orderbookUpdate`, `newPriceData`)
- Authentication required only for positions and transactions
- Automatic reconnection with subscription restoration

## Connection Setup

### Public Data (No Authentication)

```typescript
import { WebSocketClient } from '@limitless-exchange/sdk';

// Create client - SDK is completely silent (no logs)
const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  autoReconnect: true,
});

// Connect to WebSocket
await wsClient.connect();
console.log('Connected to WebSocket');
```

### Authenticated Data (Positions & Transactions)

```typescript
import { ethers } from 'ethers';
import {
  HttpClient,
  MessageSigner,
  Authenticator,
  WebSocketClient
} from '@limitless-exchange/sdk';

// 1. Authenticate first
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange'
});

const signer = new MessageSigner(wallet);
const authenticator = new Authenticator(httpClient, signer);
const { sessionCookie } = await authenticator.authenticate({
  client: 'eoa'
});

// 2. Create WebSocket client with session
const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  sessionCookie: sessionCookie,
  autoReconnect: true,
});

await wsClient.connect();
```

## Subscription Types

### Market Prices (Public)

Subscribe to live orderbook updates and price changes for specific markets.

**Event Name**: `subscribe_market_prices`

**Events Received**:
- `orderbookUpdate`: Complete orderbook state with bids/asks
- `newPriceData`: Price change notifications

```typescript
// Subscribe to market
await wsClient.subscribe('subscribe_market_prices', {
  marketSlugs: ['market-slug-here']
});

// Listen to orderbook updates
wsClient.on('orderbookUpdate' as any, (data: any) => {
  console.log('Market:', data.marketSlug);
  console.log('Timestamp:', data.timestamp);
  
  // Parse orderbook (raw API format)
  const orderbook = data.orderbook || data;
  
  if (orderbook.bids && orderbook.asks) {
    console.log('Best Bid:', orderbook.bids[0]);
    console.log('Best Ask:', orderbook.asks[0]);
  }
});

// Listen to price updates
wsClient.on('newPriceData' as any, (data: any) => {
  console.log('Price update:', data);
});
```

### Positions (Authenticated)

Subscribe to real-time position updates for your account.

**Event Name**: `subscribe_positions`

**Events Received**: `positions`

```typescript
// Subscribe to positions
await wsClient.subscribe('subscribe_positions', {
  marketSlugs: ['market-slug-here']
});

// Listen to position updates
wsClient.on('positions' as any, (data: any) => {
  console.log('Position update:', data);
  
  // Data contains your current positions
  data.forEach((position: any) => {
    console.log('Market:', position.marketSlug);
    console.log('Size:', position.size);
    console.log('Value:', position.value);
  });
});
```

### Transactions (Authenticated)

Subscribe to real-time transaction notifications (order fills, etc.).

**Event Name**: `subscribe_transactions`

**Events Received**: `tx`

```typescript
// Subscribe to transactions
await wsClient.subscribe('subscribe_transactions', {});

// Listen to transaction events
wsClient.on('tx' as any, (data: any) => {
  console.log('Transaction:', data);
  
  // Data contains transaction details
  console.log('Type:', data.type);
  console.log('Order ID:', data.orderId);
  console.log('Amount:', data.amount);
  console.log('Price:', data.price);
});
```

## Event Handling

### Raw Event Logging

The SDK passes through raw API events. You can log all events for debugging:

```typescript
// Log ALL raw events (for debugging)
(wsClient as any).socket?.onAny?.((eventName: string, ...args: any[]) => {
  console.log(\`\n📨 Raw Event: "\${eventName}"\`);
  console.log(JSON.stringify(args, null, 2));
});
```

### System Events

The SDK also provides system-level events:

```typescript
// Connection events
wsClient.on('connect', () => {
  console.log('✅ Connected');
});

wsClient.on('disconnect', (reason: string) => {
  console.log(\`⚠️  Disconnected: \${reason}\`);
});

wsClient.on('error', (error: Error) => {
  console.error('❌ Error:', error.message);
});
```

### Complete Example

```typescript
import { WebSocketClient } from '@limitless-exchange/sdk';

const MARKET_SLUG = 'your-market-slug';

// Create client
const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  autoReconnect: true,
});

// Setup event handlers
wsClient.on('connect', () => {
  console.log('✅ Connected');
});

wsClient.on('orderbookUpdate' as any, (data: any) => {
  const orderbook = data.orderbook || data;
  
  if (orderbook.bids?.length > 0 && orderbook.asks?.length > 0) {
    const bestBid = orderbook.bids[0];
    const bestAsk = orderbook.asks[0];
    const spread = bestAsk.price - bestBid.price;
    
    console.log(\`Bid: \${bestBid.price} | Ask: \${bestAsk.price} | Spread: \${spread}\`);
  }
});

// Connect and subscribe
await wsClient.connect();
await wsClient.subscribe('subscribe_market_prices', {
  marketSlugs: [MARKET_SLUG]
});

console.log('Monitoring orderbook...');
```

## Best Practices

### 1. Raw Data Parsing

The SDK transmits raw API data. Parse it in your application code:

```typescript
// ✅ GOOD - Parse in your code
wsClient.on('orderbookUpdate' as any, (data: any) => {
  // Handle different possible data structures
  const orderbook = data.orderbook || data;
  
  // Validate before using
  if (!orderbook.bids || !orderbook.asks) {
    console.warn('Invalid orderbook data');
    return;
  }
  
  // Now safely use the data
  const bestBid = orderbook.bids[0];
  const bestAsk = orderbook.asks[0];
});
```

### 2. Silent SDK

The SDK has no logging by default. Add your own logging as needed:

```typescript
// SDK is silent - add your own logs
wsClient.on('orderbookUpdate' as any, (data: any) => {
  console.log('[MyApp] Orderbook update received');
  // Your parsing logic
});
```

### 3. Connection Management

```typescript
// Handle reconnection
wsClient.on('disconnect', (reason: string) => {
  console.log(\`Disconnected: \${reason}\`);
  
  if (reason === 'io server disconnect') {
    // Server disconnected us, reconnect manually
    wsClient.connect();
  }
  // Otherwise auto-reconnect handles it
});

// Clean disconnect on shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  wsClient.disconnect();
  process.exit(0);
});
```

### 4. Error Handling

```typescript
wsClient.on('error', (error: Error) => {
  console.error('WebSocket error:', error.message);
  
  // Decide whether to reconnect or exit
  if (error.message.includes('authentication')) {
    console.error('Auth failed - check session cookie');
    process.exit(1);
  }
});
```

### 5. Subscription Management

```typescript
// Keep track of subscriptions
const activeSubscriptions = new Set<string>();

async function subscribeToMarket(marketSlug: string) {
  if (activeSubscriptions.has(marketSlug)) {
    console.log('Already subscribed to', marketSlug);
    return;
  }
  
  await wsClient.subscribe('subscribe_market_prices', {
    marketSlugs: [marketSlug]
  });
  
  activeSubscriptions.add(marketSlug);
  console.log('Subscribed to', marketSlug);
}

async function unsubscribeFromMarket(marketSlug: string) {
  if (!activeSubscriptions.has(marketSlug)) {
    console.log('Not subscribed to', marketSlug);
    return;
  }
  
  await wsClient.unsubscribe('subscribe_market_prices', {
    marketSlugs: [marketSlug]
  });
  
  activeSubscriptions.delete(marketSlug);
  console.log('Unsubscribed from', marketSlug);
}
```

### 6. Data Validation

```typescript
// Validate data structure before using
function validateOrderbookData(data: any): boolean {
  const orderbook = data.orderbook || data;
  
  if (!orderbook) {
    console.error('No orderbook data');
    return false;
  }
  
  if (!Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) {
    console.error('Invalid orderbook structure');
    return false;
  }
  
  if (orderbook.bids.length === 0 || orderbook.asks.length === 0) {
    console.warn('Empty orderbook');
    return false;
  }
  
  return true;
}

// Use in event handler
wsClient.on('orderbookUpdate' as any, (data: any) => {
  if (!validateOrderbookData(data)) {
    return;
  }
  
  // Safe to use data
  const orderbook = data.orderbook || data;
  // ...
});
```

### 7. Performance Monitoring

```typescript
// Track event frequency
let eventCount = 0;
let lastReport = Date.now();

wsClient.on('orderbookUpdate' as any, (data: any) => {
  eventCount++;
  
  // Report every 10 seconds
  const now = Date.now();
  if (now - lastReport > 10000) {
    const rate = eventCount / ((now - lastReport) / 1000);
    console.log(\`Event rate: \${rate.toFixed(2)} updates/sec\`);
    
    eventCount = 0;
    lastReport = now;
  }
  
  // Process data
  // ...
});
```

## Examples

- [Raw WebSocket Events](../../examples/project-integration/src/test-websocket-events.ts)
- [Orderbook Monitoring](../../examples/project-integration/src/websocket-orderbook.ts)
- [Trading with WebSocket](../../examples/project-integration/src/websocket-trading.ts)

## Next Steps

- [Markets](../markets/README.md) - Fetch market data and orderbooks
- [Orders](../orders/README.md) - Create and manage orders
- [Portfolio](../portfolio/README.md) - Track positions and balances
