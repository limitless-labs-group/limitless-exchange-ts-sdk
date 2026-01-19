# Markets

Complete guide to fetching market data and orderbooks from the Limitless Exchange.

## Table of Contents

- [Overview](#overview)
- [Market Discovery](#market-discovery)
  - [Basic Setup](#basic-setup)
  - [Get Active Markets](#get-active-markets)
  - [Get Market Details](#get-market-details)
- [Orderbook Data](#orderbook-data)
  - [Get Current Orderbook](#get-current-orderbook)
- [Best Practices](#best-practices)

## Overview

The Markets API provides access to:

- **Market Discovery**: Find available prediction markets
- **Orderbook Data**: Current bids and asks for CLOB markets
- **Market Statistics**: Volume, liquidity, and price data

All market data is public and doesn't require authentication.

## Market Discovery

### Basic Setup

```typescript
import { HttpClient, MarketFetcher } from '@limitless-exchange/sdk';

const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
});

const marketFetcher = new MarketFetcher(httpClient);
```

### Get Active Markets

Fetch active prediction markets with sorting and pagination support. **No authentication required** - this is a public endpoint!

#### Basic Usage

```typescript
// Get active markets
const markets = await marketFetcher.getActiveMarkets();

console.log(`Found ${markets.data.length} of ${markets.totalMarketsCount} markets`);
console.log(JSON.stringify(markets, null, 2));
```

#### With Sorting

```typescript
// Sort by LP rewards (markets with highest liquidity provider rewards)
const lpRewardsMarkets = await marketFetcher.getActiveMarkets({
  limit: 10,
  sortBy: 'lp_rewards',
});

console.log(JSON.stringify(lpRewardsMarkets, null, 2));

// Sort by ending soon (markets closing soonest)
const endingSoonMarkets = await marketFetcher.getActiveMarkets({
  limit: 10,
  sortBy: 'ending_soon',
});

// Sort by newest markets
const newestMarkets = await marketFetcher.getActiveMarkets({
  limit: 10,
  sortBy: 'newest',
});

// Sort by high value (markets with highest total value)
const highValueMarkets = await marketFetcher.getActiveMarkets({
  limit: 10,
  sortBy: 'high_value',
});
```

**Available `sortBy` values**:

- `'lp_rewards'` - Markets with highest LP rewards
- `'ending_soon'` - Markets closing soonest
- `'newest'` - Most recently created markets
- `'high_value'` - Markets with highest total value

#### With Pagination

```typescript
// Get first page (10 markets)
const page1 = await marketFetcher.getActiveMarkets({
  limit: 10,
  page: 1,
  sortBy: 'lp_rewards',
});

console.log(`Page 1: ${page1.data.length} markets`);
console.log(`Total available: ${page1.totalMarketsCount} markets`);

// Get second page
const page2 = await marketFetcher.getActiveMarkets({
  limit: 10,
  page: 2,
  sortBy: 'lp_rewards',
});

console.log(`Page 2: ${page2.data.length} markets`);
```

#### Response Structure

```typescript
interface ActiveMarketsResponse {
  data: Market[]; // Array of market objects
  totalMarketsCount: number; // Total number of active markets
}

interface Market {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: 'CLOB' | 'NEGRISK';
  createdAt: string;
  resolutionDate?: string;
  volume24h?: number;
  liquidity?: number;
  // ... other market fields
}
```

### Get Market Details

Fetch comprehensive market information including venue data for order signing.

```typescript
// Get specific market by slug
const market = await marketFetcher.getMarket('market-slug-here');

console.log(JSON.stringify(market, null, 2));

// Access specific fields
console.log('Title:', market.title);
console.log('Type:', market.marketType);
console.log('Created:', market.createdAt);

// Venue information for order signing
if (market.venue) {
  console.log('Exchange Contract:', market.venue.exchange);
  console.log('Adapter Contract:', market.venue.adapter);
}

// Token IDs for CLOB markets
if (market.tokens) {
  console.log('YES Token:', market.tokens.yes);
  console.log('NO Token:', market.tokens.no);
}
```

**Important**: The `venue` field contains contract addresses used for order signing. Always fetch market details before creating orders to cache venue data.

### Get User Orders for a Market

```typescript
// Requires API key authentication
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY,
});

const marketFetcher = new MarketFetcher(httpClient);

// Get market and user orders
const market = await marketFetcher.getMarket('market-slug-here');
const orders = await market.getUserOrders(); // to get this we need to pas API key

console.log(`Found ${orders.length} orders for ${market.title}`);
console.log(JSON.stringify(orders, null, 2));
```

## Orderbook Data

### Get Current Orderbook

```typescript
const orderbook = await marketFetcher.getOrderBook('market-slug-here');

console.log(JSON.stringify(orderbook, null, 2));

// Check if orderbook has liquidity
if (orderbook.bids.length === 0 || orderbook.asks.length === 0) {
  console.log('No orders on orderbook');
  return;
}

// Display best prices
const bestBid = orderbook.bids[0];
const bestAsk = orderbook.asks[0];

console.log('Best Bid:', bestBid.price, '-', bestBid.size, 'shares');
console.log('Best Ask:', bestAsk.price, '-', bestAsk.size, 'shares');

// Calculate spread
const spread = bestAsk.price - bestBid.price;
const spreadPercent = (spread / bestBid.price) * 100;

console.log('Spread:', spread, `(${spreadPercent.toFixed(2)}%)`);
```

#### Orderbook Structure

```typescript
interface OrderbookLevel {
  price: number; // Price level (0-1 representing 0%-100%)
  size: number; // Total shares available at this price
}

interface Orderbook {
  bids: OrderbookLevel[]; // Buy orders, sorted high to low
  asks: OrderbookLevel[]; // Sell orders, sorted low to high
  timestamp: number; // Last update timestamp
}
```

## Best Practices

### 1. Venue Caching for Order Signing

Always fetch market details before creating orders to cache venue data and eliminate redundant API calls.

```typescript
import { MarketFetcher, OrderClient } from '@limitless-exchange/sdk';
import { ethers } from 'ethers';

// Create marketFetcher once
const marketFetcher = new MarketFetcher(httpClient);

// Fetch market details (automatically caches venue)
const market = await marketFetcher.getMarket('market-slug');

// Share marketFetcher with OrderClient for venue caching
const orderClient = new OrderClient({
  httpClient,
  wallet: new ethers.Wallet(process.env.PRIVATE_KEY!),
  marketFetcher, // Shared instance - venue already cached!
});

// Create order (uses cached venue - no extra API calls)
await orderClient.createGTCOrder({
  marketId: 'market-slug',
  side: 'BUY',
  price: 0.65,
  amount: 10,
});
```

**Performance Benefits**:

- Zero extra API calls - venue data reused from market fetch
- Faster order creation - no network round-trip for venue lookup
- Automatic caching - SDK handles cache management internally

### 2. Error Handling

```typescript
import { APIError } from '@limitless-exchange/sdk';

try {
  const orderbook = await marketFetcher.getOrderBook('market-slug');
  console.log(JSON.stringify(orderbook, null, 2));
} catch (error) {
  if (error instanceof APIError) {
    console.error('API Error:', error.status, error.message);
    console.error('Response:', JSON.stringify(error.data, null, 2));
  } else {
    console.error('Unknown error:', error);
  }
}
```

### 3. Real-time Updates

For real-time orderbook updates, use WebSocket instead of polling:

```typescript
// ❌ BAD - Polling (expensive, delayed)
setInterval(async () => {
  const orderbook = await marketFetcher.getOrderBook('market-slug');
}, 1000);

// ✅ GOOD - WebSocket (efficient, real-time)
import { WebSocketClient } from '@limitless-exchange/sdk';

const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  autoReconnect: true,
});

await wsClient.connect();
await wsClient.subscribe('subscribe_market_prices', {
  marketSlugs: ['market-slug'],
});

wsClient.on('orderbookUpdate' as any, (data: any) => {
  console.log(JSON.stringify(data, null, 2));
});
```

## Complete Example

```typescript
import { HttpClient, MarketFetcher } from '@limitless-exchange/sdk';

async function main() {
  const httpClient = new HttpClient({
    baseURL: 'https://api.limitless.exchange',
  });

  const marketFetcher = new MarketFetcher(httpClient);

  // Get top 10 markets by LP rewards
  const markets = await marketFetcher.getActiveMarkets({
    limit: 10,
    sortBy: 'lp_rewards',
  });

  console.log(`Found ${markets.data.length} of ${markets.totalMarketsCount} markets`);
  console.log(JSON.stringify(markets, null, 2));

  // Get details for first market
  if (markets.data.length > 0) {
    const marketSlug = markets.data[0].slug;
    const market = await marketFetcher.getMarket(marketSlug);

    console.log('\nMarket Details:');
    console.log(JSON.stringify(market, null, 2));

    // Get orderbook
    const orderbook = await marketFetcher.getOrderBook(marketSlug);

    console.log('\nOrderbook:');
    console.log(JSON.stringify(orderbook, null, 2));
  }
}

main().catch(console.error);
```

## Examples

Complete working examples:

- [Fetching Active Markets](../../docs/code-samples/active-markets.ts)
- [Fetching Orderbooks](../../docs/code-samples/orderbook.ts)
- [WebSocket Events](../../docs/code-samples/websocket-events.ts)

## Next Steps

- [Orders](../orders/README.md) - Create and manage orders
- [WebSocket](../websocket/README.md) - Real-time market data
- [Portfolio](../portfolio/README.md) - Track positions and balances
