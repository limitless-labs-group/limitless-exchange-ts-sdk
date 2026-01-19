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

**Public Subscriptions** (no authentication required):

- **Market Prices**: Live orderbook updates and price changes

**Authenticated Subscriptions** (require API key):

- **Positions**: Real-time position updates for authenticated users
- **Transactions**: Live order fills and transaction notifications

**Key Characteristics**:

- SDK is a **raw data passthrough** - no transformations
- Events use exact API event names (e.g., `orderbookUpdate`, `newPriceData`)
- **API key not required** for public subscriptions (prices, orderbook)
- API key required for positions and transactions
- Automatic reconnection with subscription restoration

## Connection Setup

### Public Data (No Authentication)

For public subscriptions (orderbook, prices), no API key is required:

```typescript
import { WebSocketClient } from '@limitless-exchange/sdk';

// Create client for public data - NO API KEY NEEDED
const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  autoReconnect: true,
});

// Connect to WebSocket
await wsClient.connect();
console.log('Connected to WebSocket');

// Subscribe to public market prices
await wsClient.subscribe('subscribe_market_prices', {
  marketSlugs: ['bitcoin-2024'],
});
```

### Authenticated Data (Positions & Transactions)

For authenticated subscriptions (positions, transactions), you **must provide an API key**.

**API Key Authentication**:

- Required for positions and transactions subscriptions
- SDK sends X-API-Key header automatically
- Same API key used for HTTP REST API

**Setup**:

1. **Generate an API key** at https://limitless.exchange
2. **Set environment variable** or pass directly to constructor

```typescript
import { WebSocketClient } from '@limitless-exchange/sdk';

// Option 1: Use environment variable
// Set LIMITLESS_API_KEY in your .env file
const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  autoReconnect: true,
  // apiKey will be read from process.env.LIMITLESS_API_KEY
});

// Option 2: Pass API key directly
const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  apiKey: 'lx_your_api_key_here',
  autoReconnect: true,
});

// Connect to WebSocket
await wsClient.connect();
console.log('Connected to WebSocket');

// Subscribe to authenticated data
await wsClient.subscribe('subscribe_positions', {
  marketSlugs: ['bitcoin-2024'],
});

await wsClient.subscribe('subscribe_transactions', {});
```

**Error Handling**:

If you try to subscribe to authenticated channels without an API key:

```typescript
// ❌ This will throw an error
const wsClient = new WebSocketClient(); // No API key
await wsClient.subscribe('subscribe_positions', { marketSlugs: ['bitcoin-2024'] });

// Error: API key is required for 'subscribe_positions' subscription.
// Please provide an API key in the constructor or set LIMITLESS_API_KEY environment variable.
```

## Subscription Types

### Market Prices (Public)

Subscribe to live orderbook updates and price changes for specific markets.

**Event Name**: `subscribe_market_prices`

**Events Received**:

- `orderbookUpdate`: Complete orderbook state with bids/asks/metadata (CLOB markets)
- `newPriceData`: AMM price updates with market addresses and block numbers

```typescript
// Subscribe to market
await wsClient.subscribe('subscribe_market_prices', {
  marketSlugs: ['market-slug-here'],
});

// Listen to orderbook updates (CLOB markets)
wsClient.on('orderbookUpdate' as any, (data: any) => {
  console.log(JSON.stringify(data, null, 2));
});

// Listen to AMM price updates (uses marketAddress, not marketSlug!)
wsClient.on('newPriceData' as any, (data: any) => {
  console.log(JSON.stringify(data, null, 2));
});
```

### Positions (Authenticated)

Subscribe to real-time position updates for your account.

**Event Name**: `subscribe_positions`

**Events Received**: `positions`

```typescript
// Subscribe to positions
await wsClient.subscribe('subscribe_positions', {
  marketSlugs: ['market-slug-here'],
});

// Listen to position updates
wsClient.on('positions' as any, (data: any) => {
  console.log(JSON.stringify(data, null, 2));
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
  console.log(JSON.stringify(data, null, 2));
});
```

## Event Handling

### Raw Event Logging

The SDK passes through raw API events. You can log all events for debugging:

```typescript
// Log ALL raw events (for debugging)
(wsClient as any).socket?.onAny?.((eventName: string, ...args: any[]) => {
  console.log(`\n📨 Raw Event: "${eventName}"`);
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
  console.log(`⚠️  Disconnected: ${reason}`);
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
  console.log(JSON.stringify(data, null, 2));
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
  console.log(JSON.stringify(orderbook, null, 2));
});
```

### 2. Connection Management

```typescript
// Handle reconnection
wsClient.on('disconnect', (reason: string) => {
  console.log(`Disconnected: ${reason}`);

  if (reason === 'io server disconnect') {
    // Server disconnected us, reconnect manually
    wsClient.connect(); // Returns promise but fire-and-forget is OK here
  }
  // Otherwise auto-reconnect handles it
});

// Clean disconnect on shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await wsClient.disconnect(); // Now async
  process.exit(0);
});
```

### 3. Error Handling

```typescript
wsClient.on('error', (error: Error) => {
  console.error('WebSocket error:', error.message);

  // Decide whether to reconnect or exit
  if (error.message.includes('authentication')) {
    console.error('Auth failed - check API key');
    process.exit(1);
  }
});
```

## Type Definitions

### OrderbookUpdate (CLOB Markets)

Complete orderbook state with nested structure.

```typescript
interface OrderbookUpdate {
  marketSlug: string; // Market slug identifier (camelCase)
  orderbook: OrderbookData; // Nested orderbook object
  timestamp: Date | number | string; // Event timestamp
}

interface OrderbookData {
  bids: OrderbookEntry[]; // List of bid orders (descending)
  asks: OrderbookEntry[]; // List of ask orders (ascending)
  tokenId: string; // Token ID for the orderbook
  adjustedMidpoint: number; // Adjusted midpoint price
  maxSpread: number; // Maximum spread allowed
  minSize: number; // Minimum order size
}

interface OrderbookEntry {
  price: number; // Price per share (0-1 range)
  size: number; // Size in shares
}
```

**Example Data:**

```json
{
  "marketSlug": "btc-price-100k",
  "orderbook": {
    "bids": [{ "price": 0.52, "size": 100 }],
    "asks": [{ "price": 0.55, "size": 150 }],
    "tokenId": "0x123...",
    "adjustedMidpoint": 0.535,
    "maxSpread": 0.1,
    "minSize": 10
  },
  "timestamp": "2025-12-08T10:30:00Z"
}
```

### NewPriceData (AMM Markets)

AMM price updates with market addresses.

```typescript
interface NewPriceData {
  marketAddress: string; // Market contract address (NOT marketSlug!)
  updatedPrices: AmmPriceEntry[]; // Array of price updates
  blockNumber: number; // Blockchain block number
  timestamp: Date | number | string; // Event timestamp
}

interface AmmPriceEntry {
  marketId: number; // Market ID
  marketAddress: string; // Market contract address
  yesPrice: number; // YES token price (0-1 range)
  noPrice: number; // NO token price (0-1 range)
}
```

**Example Data:**

```json
{
  "marketAddress": "0xabc...",
  "updatedPrices": [
    {
      "marketId": 123,
      "marketAddress": "0xabc...",
      "yesPrice": 0.65,
      "noPrice": 0.35
    }
  ],
  "blockNumber": 12345678,
  "timestamp": "2025-12-08T10:30:00Z"
}
```

### TransactionEvent

Transaction event fields from `tx` event.

```typescript
interface TransactionEvent {
  userId?: number;
  txHash?: string;
  status: 'CONFIRMED' | 'FAILED';
  source: string;
  timestamp: Date;
  marketAddress?: string;
  marketSlug?: string;
  tokenId?: string;
  conditionId?: string;
  amountContracts?: string;
  amountCollateral?: string;
  price?: string;
  side?: 'BUY' | 'SELL';
}
```

**Example Data:**

```json
{
  "userId": 123,
  "txHash": "0xabc...",
  "status": "CONFIRMED",
  "source": "clob",
  "marketSlug": "market-slug",
  "marketAddress": "0x123...",
  "tokenId": "0x456...",
  "amountContracts": "10",
  "amountCollateral": "6.5",
  "price": "0.65",
  "side": "BUY",
  "timestamp": "2025-12-08T10:30:00Z"
}
```

### Important Notes

- **Nested Structure**: `orderbookUpdate` sends `orderbook` as a nested object, not flattened
- **Field Naming**: All fields use camelCase (e.g., `marketSlug`, `tokenId`, `updatedPrices`)
- **AMM vs CLOB**: `newPriceData` uses `marketAddress` while `orderbookUpdate` uses `marketSlug`
- **Type Safety**: See `/src/types/websocket.ts` for complete TypeScript definitions

## Examples

Complete working examples:

- [WebSocket Events](../../docs/code-samples/websocket-events.ts)

## Next Steps

- [Markets](../markets/README.md) - Fetch market data and orderbooks
- [Orders](../orders/README.md) - Create and manage orders
- [Portfolio](../portfolio/README.md) - Track positions and balances
