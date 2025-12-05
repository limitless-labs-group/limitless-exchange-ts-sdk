# Markets

Complete guide to fetching market data and orderbooks from the Limitless Exchange.

## Table of Contents

- [Overview](#overview)
- [Market Discovery](#market-discovery)
- [Orderbook Data](#orderbook-data)
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
import { HttpClient, MarketFetcher } from '@limitless/exchange-ts-sdk';

const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  timeout: 30000,
});

const marketFetcher = new MarketFetcher(httpClient);
```

### Find Markets

```typescript
// Get all available markets
const markets = await marketFetcher.getMarkets();

console.log(\`Found \${markets.length} markets\`);

markets.forEach(market => {
  console.log('Market:', market.slug);
  console.log('Title:', market.title);
  console.log('Type:', market.marketType); // CLOB or AMM
  console.log('---');
});
```

### Search Markets

```typescript
// Search by keyword
const searchResults = await marketFetcher.searchMarkets('bitcoin');

searchResults.forEach(market => {
  console.log('Match:', market.title);
  console.log('Slug:', market.slug);
});
```

### Get Market Details

```typescript
// Get specific market by slug
const market = await marketFetcher.getMarket('market-slug-here');

console.log('Title:', market.title);
console.log('Description:', market.description);
console.log('Type:', market.marketType);
console.log('Created:', market.createdAt);
console.log('Outcomes:', market.outcomes);
```

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
  price: number;  // Price level (0-1 representing 0%-100%)
  size: number;   // Total shares available at this price
}

interface Orderbook {
  bids: OrderbookLevel[];  // Buy orders, sorted high to low
  asks: OrderbookLevel[];  // Sell orders, sorted low to high
  timestamp: number;       // Last update timestamp
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

// Liquidity data
console.log('Total Liquidity:', market.liquidity);
```

### Calculate Metrics

```typescript
async function getMarketMetrics(marketSlug: string) {
  const [market, orderbook] = await Promise.all([
    marketFetcher.getMarket(marketSlug),
    marketFetcher.getOrderBook(marketSlug)
  ]);

  // Calculate mid price
  const midPrice = orderbook.bids.length > 0 && orderbook.asks.length > 0
    ? (orderbook.bids[0].price + orderbook.asks[0].price) / 2
    : market.currentPrice;

  // Calculate spread
  const spread = orderbook.asks.length > 0 && orderbook.bids.length > 0
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

### 1. Error Handling

```typescript
import { ApiError } from '@limitless/exchange-ts-sdk';

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

### 2. Caching

```typescript
class MarketCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 5000; // 5 seconds

  async getOrderBook(
    marketFetcher: MarketFetcher,
    marketSlug: string
  ): Promise<any> {
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

### 3. Rate Limiting

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
    
    const orderbooks = await Promise.all(
      batch.map(slug => marketFetcher.getOrderBook(slug))
    );
    
    batch.forEach((slug, index) => {
      results.set(slug, orderbooks[index]);
    });
    
    // Delay between batches
    if (i + batchSize < marketSlugs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}
```

### 4. Data Validation

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

### 5. Market Comparison

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

### 6. Real-time Updates

For real-time orderbook updates, use WebSocket instead of polling:

```typescript
// ❌ BAD - Polling (expensive, delayed)
setInterval(async () => {
  const orderbook = await marketFetcher.getOrderBook('market-slug');
  // Process orderbook
}, 1000);

// ✅ GOOD - WebSocket (efficient, real-time)
import { WebSocketClient } from '@limitless/exchange-ts-sdk';

const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  autoReconnect: true,
});

await wsClient.connect();
await wsClient.subscribe('subscribe_market_prices', {
  marketSlugs: ['market-slug']
});

wsClient.on('orderbookUpdate' as any, (data: any) => {
  // Process real-time updates
});
```

## Examples

- [Fetching Orderbooks](../../examples/project-integration/src/orderbook.ts)
- [Real-time Orderbook Monitoring](../../examples/project-integration/src/websocket-orderbook.ts)

## Next Steps

- [Orders](../orders/README.md) - Create and manage orders
- [WebSocket](../websocket/README.md) - Real-time market data
- [Portfolio](../portfolio/README.md) - Track positions and balances
