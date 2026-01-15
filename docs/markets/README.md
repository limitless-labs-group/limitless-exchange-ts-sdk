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
  - [Orderbook Structure](#orderbook-structure)
  - [Analyze Market Depth](#analyze-market-depth)
- [Market Statistics](#market-statistics)
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
  timeout: 30000,
});

const marketFetcher = new MarketFetcher(httpClient);
```

### Get Active Markets

The `getActiveMarkets` method allows you to fetch active prediction markets with sorting and pagination support.

**No authentication required** - this is a public endpoint!

#### Basic Usage

```typescript
// Get active markets (default behavior - returns all active markets)
const markets = await marketFetcher.getActiveMarkets();

console.log(`Found ${markets.data.length} of ${markets.totalMarketsCount} markets`);

markets.data.forEach((market) => {
  console.log('Title:', market.title);
  console.log('Slug:', market.slug);
  console.log('Type:', market.type);
  console.log('---');
});
```

#### Sorting Options

Fetch markets sorted by different criteria:

```typescript
// Sort by LP rewards (markets with highest liquidity provider rewards)
const lpRewardsMarkets = await marketFetcher.getActiveMarkets({
  limit: 8,
  sortBy: 'lp_rewards',
});

// Sort by ending soon (markets closing soonest)
const endingSoonMarkets = await marketFetcher.getActiveMarkets({
  limit: 8,
  sortBy: 'ending_soon',
});

// Sort by newest markets
const newestMarkets = await marketFetcher.getActiveMarkets({
  limit: 8,
  sortBy: 'newest',
});

// Sort by high value (markets with highest total value)
const highValueMarkets = await marketFetcher.getActiveMarkets({
  limit: 8,
  sortBy: 'high_value',
});
```

**Available `sortBy` values**:

- `'lp_rewards'` - Markets with highest LP rewards
- `'ending_soon'` - Markets closing soonest
- `'newest'` - Most recently created markets
- `'high_value'` - Markets with highest total value

#### Pagination

Use pagination to fetch markets in batches:

```typescript
// Get first page (8 markets)
const page1 = await marketFetcher.getActiveMarkets({
  limit: 8,
  page: 1,
  sortBy: 'lp_rewards',
});

console.log(`Page 1: ${page1.data.length} markets`);
console.log(`Total available: ${page1.totalMarketsCount} markets`);

// Get second page
const page2 = await marketFetcher.getActiveMarkets({
  limit: 8,
  page: 2,
  sortBy: 'lp_rewards',
});

console.log(`Page 2: ${page2.data.length} markets`);
```

#### Paginate Through All Markets

```typescript
async function fetchAllActiveMarkets(
  marketFetcher: MarketFetcher,
  sortBy: 'lp_rewards' | 'ending_soon' | 'newest' | 'high_value' = 'newest'
) {
  const allMarkets = [];
  let currentPage = 1;
  const pageSize = 20;

  while (true) {
    const response = await marketFetcher.getActiveMarkets({
      limit: pageSize,
      page: currentPage,
      sortBy,
    });

    allMarkets.push(...response.data);

    console.log(`Fetched page ${currentPage} with ${response.data.length} markets`);

    // Check if we've fetched all markets
    if (response.data.length < pageSize || allMarkets.length >= response.totalMarketsCount) {
      break;
    }

    currentPage++;
  }

  console.log(`Total markets fetched: ${allMarkets.length}`);
  return allMarkets;
}

// Usage
const allMarkets = await fetchAllActiveMarkets(marketFetcher, 'lp_rewards');
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
  // ... other market fields
}
```

#### Filter and Process Markets

```typescript
// Get markets and filter by criteria
const markets = await marketFetcher.getActiveMarkets({
  limit: 50,
  sortBy: 'newest',
});

// Filter markets ending within 7 days
const endingSoon = markets.data.filter((market) => {
  if (!market.resolutionDate) return false;
  const daysUntilResolution =
    (new Date(market.resolutionDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntilResolution <= 7 && daysUntilResolution > 0;
});

console.log(`${endingSoon.length} markets ending within 7 days`);

// Filter by market type
const clobMarkets = markets.data.filter((m) => m.type === 'CLOB');
const negriskMarkets = markets.data.filter((m) => m.type === 'NEGRISK');

console.log(`CLOB markets: ${clobMarkets.length}`);
console.log(`NegRisk markets: ${negriskMarkets.length}`);
```

#### Complete Example

```typescript
import { HttpClient, MarketFetcher } from '@limitless-exchange/sdk';

async function displayTopMarkets() {
  const httpClient = new HttpClient({
    baseURL: 'https://api.limitless.exchange',
  });

  const marketFetcher = new MarketFetcher(httpClient);

  // Get top 10 markets by LP rewards
  const response = await marketFetcher.getActiveMarkets({
    limit: 10,
    sortBy: 'lp_rewards',
  });

  console.log(`Displaying top ${response.data.length} of ${response.totalMarketsCount} markets:\n`);

  response.data.forEach((market, index) => {
    console.log(`${index + 1}. ${market.title}`);
    console.log(`   Slug: ${market.slug}`);
    console.log(`   Type: ${market.type}`);

    if (market.resolutionDate) {
      const resolveDate = new Date(market.resolutionDate);
      console.log(`   Resolves: ${resolveDate.toLocaleDateString()}`);
    }

    console.log('');
  });
}

displayTopMarkets().catch(console.error);
```

For a complete working example, see [examples/project-integration/src/active-markets.ts](../../examples/project-integration/src/active-markets.ts).

### Get Market Details

Fetching market details returns comprehensive information including **venue data** for order signing.

```typescript
// Get specific market by slug (automatically caches venue)
const market = await marketFetcher.getMarket('market-slug-here');

console.log('Title:', market.title);
console.log('Description:', market.description);
console.log('Type:', market.marketType);
console.log('Created:', market.createdAt);

// Venue information for order signing and approvals
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

**Important**: The `venue` field contains critical contract addresses:
- **`venue.exchange`**: Used as `verifyingContract` for EIP-712 order signing
- **`venue.adapter`**: Required for NegRisk/Grouped market SELL token approvals

**Performance Best Practice**: Always call `getMarket()` before creating orders to cache venue data and avoid redundant API calls during order signing.

## Orderbook Data

### Get Current Orderbook

```typescript
const orderbook = await marketFetcher.getOrderBook('market-slug-here');

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

console.log('Spread:', spread, \`(\${spreadPercent.toFixed(2)}%)\`);
```

### Orderbook Structure

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

### Analyze Market Depth

```typescript
const orderbook = await marketFetcher.getOrderBook('market-slug');

// Calculate total liquidity
const totalBidLiquidity = orderbook.bids.reduce(
  (sum, bid) => sum + (bid.price * bid.size),
  0
);

const totalAskLiquidity = orderbook.asks.reduce(
  (sum, ask) => sum + (ask.price * ask.size),
  0
);

console.log('Total Bid Liquidity:', totalBidLiquidity.toFixed(2));
console.log('Total Ask Liquidity:', totalAskLiquidity.toFixed(2));

// Show top 5 levels
console.log('\nTop 5 Bids:');
orderbook.bids.slice(0, 5).forEach((bid, i) => {
  console.log(\`  \${i + 1}. \${(bid.price * 100).toFixed(1)}% - \${bid.size} shares\`);
});

console.log('\nTop 5 Asks:');
orderbook.asks.slice(0, 5).forEach((ask, i) => {
  console.log(\`  \${i + 1}. \${(ask.price * 100).toFixed(1)}% - \${ask.size} shares\`);
});
```

## Market Statistics

### Get Market Stats

```typescript
const market = await marketFetcher.getMarket('market-slug');

// Volume data
console.log('24h Volume:', market.volume24h);
console.log('Total Volume:', market.totalVolume);

// Price data
console.log('Current Price:', market.currentPrice);
console.log('24h Change:', market.priceChange24h);
console.log('24h High:', market.high24h);
console.log('24h Low:', market.low24h);
```

### Calculate Metrics

```typescript
async function getMarketMetrics(marketSlug: string) {
  const [market, orderbook] = await Promise.all([
    marketFetcher.getMarket(marketSlug),
    marketFetcher.getOrderBook(marketSlug),
  ]);

  // Calculate mid price
  const midPrice =
    orderbook.bids.length > 0 && orderbook.asks.length > 0
      ? (orderbook.bids[0].price + orderbook.asks[0].price) / 2
      : market.currentPrice;

  // Calculate spread
  const spread =
    orderbook.asks.length > 0 && orderbook.bids.length > 0
      ? orderbook.asks[0].price - orderbook.bids[0].price
      : 0;

  // Total depth at top of book
  const topBidDepth = orderbook.bids[0]?.size || 0;
  const topAskDepth = orderbook.asks[0]?.size || 0;

  return {
    marketSlug,
    midPrice,
    spread,
    spreadPercent: (spread / midPrice) * 100,
    topBidDepth,
    topAskDepth,
    volume24h: market.volume24h,
    liquidity: market.liquidity,
  };
}

// Use it
const metrics = await getMarketMetrics('market-slug');
console.log('Market Metrics:', metrics);
```

## Best Practices

### 1. Venue Caching for Order Signing

**Always fetch market details before creating orders** to cache venue data and eliminate redundant API calls.

```typescript
import { MarketFetcher, OrderClient } from '@limitless-exchange/sdk';

// Create marketFetcher once
const marketFetcher = new MarketFetcher(httpClient);

// Fetch market details (automatically caches venue)
const market = await marketFetcher.getMarket('market-slug');

// Share marketFetcher with OrderClient for venue caching
const orderClient = new OrderClient({
  httpClient,
  wallet,
  userData,
  marketFetcher,  // Shared instance - venue already cached!
});

// Create order (uses cached venue - no extra API calls)
await orderClient.createOrder({
  tokenId: market.tokens.yes,
  price: 0.65,
  size: 10,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: 'market-slug',
});
```

**Performance Benefits**:
- **Zero extra API calls**: Venue data reused from market fetch
- **Faster order creation**: No network round-trip for venue lookup
- **Automatic caching**: SDK handles cache management internally

**Without shared marketFetcher** (not recommended):
```typescript
// ❌ OrderClient creates its own marketFetcher
const orderClient = new OrderClient({
  httpClient,
  wallet,
  userData,
  // No marketFetcher parameter
});

// ⚠️ Warning logged: fetches market again for venue
await orderClient.createOrder({...});
```

### 2. Error Handling

```typescript
import { ApiError } from '@limitless-exchange/sdk';

try {
  const orderbook = await marketFetcher.getOrderBook('market-slug');
  console.log('Orderbook fetched successfully');
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 404:
        console.error('Market not found');
        break;
      case 429:
        console.error('Rate limited - slow down requests');
        break;
      case 500:
        console.error('Server error - try again later');
        break;
      default:
        console.error('API error:', error.message);
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

### 3. Orderbook Caching

For frequently updated data like orderbooks, implement your own caching layer:

```typescript
class OrderbookCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 5000; // 5 seconds

  async getOrderBook(marketFetcher: MarketFetcher, marketSlug: string): Promise<any> {
    const cached = this.cache.get(marketSlug);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    const data = await marketFetcher.getOrderBook(marketSlug);
    this.cache.set(marketSlug, { data, timestamp: Date.now() });

    return data;
  }

  clear() {
    this.cache.clear();
  }
}

// Usage
const cache = new MarketCache();
const orderbook = await cache.getOrderBook(marketFetcher, 'market-slug');
```

### 4. Rate Limiting

```typescript
// Batch market requests
async function getMultipleOrderbooks(
  marketFetcher: MarketFetcher,
  marketSlugs: string[]
): Promise<Map<string, any>> {
  const results = new Map();

  // Fetch in parallel with limit
  const batchSize = 3;
  for (let i = 0; i < marketSlugs.length; i += batchSize) {
    const batch = marketSlugs.slice(i, i + batchSize);

    const orderbooks = await Promise.all(batch.map((slug) => marketFetcher.getOrderBook(slug)));

    batch.forEach((slug, index) => {
      results.set(slug, orderbooks[index]);
    });

    // Delay between batches
    if (i + batchSize < marketSlugs.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
```

### 5. Data Validation

```typescript
function validateOrderbook(orderbook: any): boolean {
  // Check structure
  if (!orderbook || !Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) {
    console.error('Invalid orderbook structure');
    return false;
  }

  // Check for data
  if (orderbook.bids.length === 0 && orderbook.asks.length === 0) {
    console.warn('Empty orderbook');
    return false;
  }

  // Validate price ordering
  for (let i = 1; i < orderbook.bids.length; i++) {
    if (orderbook.bids[i].price > orderbook.bids[i - 1].price) {
      console.error('Bids not sorted correctly');
      return false;
    }
  }

  for (let i = 1; i < orderbook.asks.length; i++) {
    if (orderbook.asks[i].price < orderbook.asks[i - 1].price) {
      console.error('Asks not sorted correctly');
      return false;
    }
  }

  return true;
}

// Use before processing
const orderbook = await marketFetcher.getOrderBook('market-slug');
if (validateOrderbook(orderbook)) {
  // Safe to use
}
```

### 6. Market Comparison

```typescript
async function compareMarkets(
  marketFetcher: MarketFetcher,
  marketSlugs: string[]
) {
  const comparisons = await Promise.all(
    marketSlugs.map(async (slug) => {
      try {
        const [market, orderbook] = await Promise.all([
          marketFetcher.getMarket(slug),
          marketFetcher.getOrderBook(slug)
        ]);

        const bestBid = orderbook.bids[0]?.price || 0;
        const bestAsk = orderbook.asks[0]?.price || 0;
        const spread = bestAsk - bestBid;

        return {
          slug,
          title: market.title,
          midPrice: (bestBid + bestAsk) / 2,
          spread,
          volume24h: market.volume24h,
          liquidity: market.liquidity,
        };
      } catch (error) {
        console.error(\`Failed to fetch \${slug}:\`, error);
        return null;
      }
    })
  );

  // Filter out failures and sort by volume
  return comparisons
    .filter(c => c !== null)
    .sort((a, b) => b!.volume24h - a!.volume24h);
}

// Usage
const markets = ['market-1', 'market-2', 'market-3'];
const comparison = await compareMarkets(marketFetcher, markets);
console.table(comparison);
```

### 7. Real-time Updates

For real-time orderbook updates, use WebSocket instead of polling:

```typescript
// ❌ BAD - Polling (expensive, delayed)
setInterval(async () => {
  const orderbook = await marketFetcher.getOrderBook('market-slug');
  // Process orderbook
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
  // Process real-time updates
});
```

## Examples

Complete working examples available:

- **[Active Markets](../../examples/project-integration/src/active-markets.ts)** - Fetching and sorting active markets with pagination
- **[Fetching Orderbooks](../../examples/project-integration/src/orderbook.ts)** - Getting and analyzing orderbook data
- **[Real-time Orderbook Monitoring](../../examples/project-integration/src/websocket-orderbook.ts)** - Live orderbook updates via WebSocket

## Next Steps

- [Orders](../orders/README.md) - Create and manage orders
- [WebSocket](../websocket/README.md) - Real-time market data
- [Portfolio](../portfolio/README.md) - Track positions and balances
