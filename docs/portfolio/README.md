# Portfolio & Positions

Complete guide to tracking positions and balances on the Limitless Exchange.

## Table of Contents

- [Overview](#overview)
- [Position Tracking](#position-tracking)
- [User History](#user-history)
- [Best Practices](#best-practices)

## Overview

The Portfolio API provides access to:

- **Positions**: Your current holdings across markets (CLOB and AMM)
- **User History**: Account activity and transaction history

**Authentication Required**: All portfolio endpoints require an API key.

## Position Tracking

### Setup

```typescript
import { HttpClient, PortfolioFetcher } from '@limitless-exchange/sdk';

// Create authenticated HTTP client
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY, // Required for portfolio endpoints
});

// Create portfolio fetcher
const portfolioFetcher = new PortfolioFetcher(httpClient);
```

### Get All Positions

```typescript
// Get all your positions (CLOB + AMM)
const positions = await portfolioFetcher.getPositions();

console.log(JSON.stringify(positions, null, 2));

// Access specific data
console.log(`CLOB positions: ${positions.clob.length}`);
console.log(`AMM positions: ${positions.amm.length}`);
console.log(`Total points: ${positions.accumulativePoints}`);
```

### Get CLOB Positions Only

```typescript
const clobPositions = await portfolioFetcher.getCLOBPositions();

console.log(JSON.stringify(clobPositions, null, 2));

clobPositions.forEach(pos => {
  console.log('Market:', pos.market.title);
  console.log('YES Position:', pos.positions.yes);
  console.log('NO Position:', pos.positions.no);
  console.log('---');
});
```

### Get AMM Positions Only

```typescript
const ammPositions = await portfolioFetcher.getAMMPositions();

console.log(JSON.stringify(ammPositions, null, 2));

ammPositions.forEach(pos => {
  console.log('Market:', pos.market.title);
  console.log('YES Position:', pos.positions.yes);
  console.log('NO Position:', pos.positions.no);
  console.log('---');
});
```

### Position Data Structure

```typescript
interface PortfolioPositionsResponse {
  clob: CLOBPosition[];         // CLOB market positions
  amm: AMMPosition[];           // AMM market positions
  accumulativePoints: number;   // Total points earned
}

interface CLOBPosition {
  market: {
    id: string;
    title: string;
    slug: string;
  };
  positions: {
    yes: {
      size: number;
      collateral: number;
      unrealizedPnl: number;
    };
    no: {
      size: number;
      collateral: number;
      unrealizedPnl: number;
    };
  };
}

interface AMMPosition {
  market: {
    id: string;
    title: string;
    slug: string;
  };
  positions: {
    yes: {
      size: number;
      collateral: number;
      unrealizedPnl: number;
    };
    no: {
      size: number;
      collateral: number;
      unrealizedPnl: number;
    };
  };
}
```

## User History

### Get User History

```typescript
// Get user activity history
const history = await portfolioFetcher.getUserHistory();

console.log(JSON.stringify(history, null, 2));

console.log(`Total entries: ${history.totalCount}`);
console.log(`History items: ${history.data.length}`);

history.data.forEach(entry => {
  console.log('ID:', entry.id);
  console.log('Type:', entry.type);
  console.log('Created:', entry.createdAt);
  console.log('---');
});
```

### With Pagination

```typescript
// Get paginated history (page 1, 10 items per page)
const page1 = await portfolioFetcher.getUserHistory(1, 10);

console.log(`Page 1: ${page1.data.length} items`);
console.log(`Total: ${page1.totalCount} items`);

// Get page 2
const page2 = await portfolioFetcher.getUserHistory(2, 10);

console.log(`Page 2: ${page2.data.length} items`);
```

### History Response Structure

```typescript
interface HistoryResponse {
  data: HistoryEntry[];
  totalCount: number;
}

interface HistoryEntry {
  id: string;
  type: string;
  createdAt: string;
  marketSlug?: string;
  amount?: string;
  details?: Record<string, any>;
}
```

## Best Practices

### 1. Real-time Position Updates

Use WebSocket for real-time position tracking instead of polling:

```typescript
import { WebSocketClient } from '@limitless-exchange/sdk';

// Create WebSocket client with API key
const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY, // Required for positions
  autoReconnect: true,
});

await wsClient.connect();

// Subscribe to position updates
await wsClient.subscribe('subscribe_positions', {
  marketSlugs: ['market-slug'], // or omit for all markets
});

// Listen to updates
wsClient.on('positions' as any, (data: any) => {
  console.log(JSON.stringify(data, null, 2));
});
```

### 2. Error Handling

```typescript
import { APIError } from '@limitless-exchange/sdk';

try {
  const positions = await portfolioFetcher.getPositions();
  console.log(JSON.stringify(positions, null, 2));
} catch (error) {
  if (error instanceof APIError) {
    console.error('API Error:', error.status, error.message);
    console.error('Response:', JSON.stringify(error.data, null, 2));

    if (error.status === 401) {
      console.error('Authentication failed - check API key');
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

### 3. Combining Positions with Market Data

```typescript
import { MarketFetcher } from '@limitless-exchange/sdk';

const marketFetcher = new MarketFetcher(httpClient);

// Get positions and market data
const positions = await portfolioFetcher.getPositions();

for (const pos of positions.clob) {
  const market = await marketFetcher.getMarket(pos.market.slug);

  console.log(`${pos.market.title}:`);
  console.log(`  YES: ${pos.positions.yes.size} shares`);
  console.log(`  Current Price: ${market.currentPrice}`);
  console.log(`  Unrealized P&L: ${pos.positions.yes.unrealizedPnl}`);
}
```

## Complete Example

```typescript
import { HttpClient, PortfolioFetcher } from '@limitless-exchange/sdk';

async function main() {
  // Create authenticated client
  const httpClient = new HttpClient({
    baseURL: 'https://api.limitless.exchange',
    apiKey: process.env.LIMITLESS_API_KEY,
  });

  const portfolioFetcher = new PortfolioFetcher(httpClient);

  // Get all positions
  const positions = await portfolioFetcher.getPositions();

  console.log('Portfolio Positions:');
  console.log(JSON.stringify(positions, null, 2));

  // Get user history
  const history = await portfolioFetcher.getUserHistory(1, 10);

  console.log('\nUser History:');
  console.log(JSON.stringify(history, null, 2));
}

main().catch(console.error);
```

## Examples

Complete working examples:

- [Checking Positions](../../docs/code-samples/positions.ts)
- [WebSocket Events](../../docs/code-samples/websocket-events.ts)

## Next Steps

- [Orders](../orders/README.md) - Create and manage orders
- [Markets](../markets/README.md) - Market data and orderbooks
- [WebSocket](../websocket/README.md) - Real-time position updates
