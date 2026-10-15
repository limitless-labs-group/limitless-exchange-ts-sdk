# Portfolio & Positions

Complete guide to tracking positions and balances on the Limitless Exchange.

## Table of Contents

- [Overview](#overview)
- [Profile Lookup](#profile-lookup)
- [Position Tracking](#position-tracking)
- [User History](#user-history)
- [Best Practices](#best-practices)

## Overview

The Portfolio API provides access to:

- **Profile Lookup**: Your authenticated profile or an address-based profile lookup
- **Positions**: Your current holdings across markets (CLOB and AMM)
- **User History**: Account activity and transaction history

**Authentication Required**: Portfolio endpoints require an authenticated client.

## Profile Lookup

Use `getProfile()` without an address to fetch the authenticated caller's profile via
`GET /profiles/me`. Pass an address to keep the existing address-based lookup via
`GET /profiles/:account`.

```typescript
const currentProfile = await portfolioFetcher.getProfile();
const profileByAddress = await portfolioFetcher.getProfile(
  '0x1676716Ef7F19B5C5d690631CB57cf0bFD900A3d'
);

console.log(`Current profile ID: ${currentProfile.id}`);
console.log(`Profile account: ${profileByAddress.account}`);
```

## Position Tracking

### Setup

```typescript
import { HttpClient, PortfolioFetcher } from '@limitless-exchange/sdk';

// Create authenticated HTTP client
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  hmacCredentials: {
    tokenId: process.env.LMTS_TOKEN_ID!,
    secret: process.env.LMTS_TOKEN_SECRET!,
  },
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
  console.log('Outcome:', pos.outcomeIndex === 0 ? 'YES' : 'NO');
  console.log('Shares:', pos.outcomeTokenAmount);
  console.log('Unrealized P&L:', pos.unrealizedPnl);
  console.log('---');
});
```

### Position Data Structure

```typescript
interface PortfolioPositionsResponse {
  clob: CLOBPosition[];         // CLOB market positions
  amm: AMMPosition[];           // AMM market positions
  group: any[];                 // Group positions
  points?: string;              // User points
  accumulativePoints?: string;  // Total points earned
  rewards?: {
    todaysRewards: string;
    rewardsByEpoch: any[];
    rewardsChartData: any[];
    totalUnpaidRewards: string;
    totalUserRewardsLastEpoch: string;
  };
}

interface PositionSide {
  orderId: string | null;  // Order that opened the position (null if no position on this side)
  openedAt: string | null; // ISO 8601 (null if no position on this side)
  cost: string;            // Cost basis in USDC, raw 6-decimal units
  fillPrice: string;       // Average fill price, raw 6-decimal units
  marketValue: string;     // Current value in USDC, raw 6-decimal units
  realisedPnl: string;     // Raw 6-decimal units
  unrealizedPnl: string;   // Raw 6-decimal units
}

interface CLOBPosition {
  market: {
    id: number | string;
    slug: string;
    title: string;
    closed: boolean;
    deadline: string;
    // ... other market fields
  };
  makerAddress: string;
  positions: {
    yes: PositionSide;
    no: PositionSide;
  };
  tokensBalance: {
    yes: string; // Shares held per side, raw 6-decimal units
    no: string;
  };
  latestTrade: {
    latestYesPrice: number;
    latestNoPrice: number;
    outcomeTokenPrice: number;
  };
  orders?: {
    liveOrders: any[];
    totalCollateralLocked: string;
  };
  rewards?: {
    epochs: any[];
    isEarning: boolean;
  };
}

interface AMMPosition {
  market: {
    id: number | string;
    slug: string;
    title: string;
    closed: boolean;
    deadline: string;
    // ... other market fields
  };
  account: string;
  outcomeIndex: number;        // 0 = YES, 1 = NO
  collateralAmount: string;
  outcomeTokenAmount: string;  // Shares held, decimal string (not raw units)
  averageFillPrice: string;
  totalBuysCost: string;
  totalSellsCost: string;
  realizedPnl: string;
  unrealizedPnl: string;
  latestTrade?: {
    outcomeTokenPrice: string;
  };
}
```

## User History

### Get User History

```typescript
// Get user activity history
const history = await portfolioFetcher.getUserHistory();

console.log(JSON.stringify(history, null, 2));

console.log(`History items: ${history.data.length}`);
console.log(`Next cursor: ${history.nextCursor}`);

history.data.forEach(entry => {
  console.log('Strategy:', entry.strategy);
  console.log('Market:', entry.market?.slug);
  console.log('Timestamp:', entry.blockTimestamp);
  console.log('---');
});
```

### With Pagination

```typescript
// Get the first page with a custom limit.
// The SDK sends cursor= on the wire for the first request.
const page1 = await portfolioFetcher.getUserHistory('', 10);

console.log(`Page 1: ${page1.data.length} items`);

// Get page 2 using the returned cursor
if (page1.nextCursor) {
  const page2 = await portfolioFetcher.getUserHistory(page1.nextCursor, 10);

  console.log(`Page 2: ${page2.data.length} items`);
}
```

### History Response Structure

```typescript
interface HistoryResponse {
  data: HistoryEntry[];
  nextCursor: string | null;
}

interface HistoryEntry {
  blockTimestamp: number;
  collateralAmount?: string;
  market?: {
    id: string;
    slug: string;
    title: string;
    conditionId?: string;
    expirationDate?: string;
  };
  outcomeIndex?: number;
  outcomeTokenAmount?: string;
  outcomeTokenAmounts?: string[];
  outcomeTokenPrice?: number | string;
  strategy?: string;
  transactionHash?: string;
}
```

## Best Practices

### 1. Real-time Position Updates

Use WebSocket for real-time position tracking instead of polling:

```typescript
import { WebSocketClient } from '@limitless-exchange/sdk';

// Create WebSocket client with HMAC credentials
const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  hmacCredentials: {
    tokenId: process.env.LMTS_TOKEN_ID!,
    secret: process.env.LMTS_TOKEN_SECRET!,
  },
  autoReconnect: true,
});

await wsClient.connect();

// Subscribe to position updates
await wsClient.subscribe('subscribe_positions', {
  marketSlugs: ['market-slug'], // or omit for all markets
});

// Listen to updates
wsClient.on('positions', (data) => {
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
      console.error('Authentication failed - check your API token credentials');
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
  console.log(`  YES: ${Number(pos.tokensBalance.yes) / 1e6} shares`);
  console.log(`  Current Price: ${market.prices?.[0]}`);
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
    hmacCredentials: {
      tokenId: process.env.LMTS_TOKEN_ID!,
      secret: process.env.LMTS_TOKEN_SECRET!,
    },
  });

  const portfolioFetcher = new PortfolioFetcher(httpClient);

  // Get all positions
  const positions = await portfolioFetcher.getPositions();

  console.log('Portfolio Positions:');
  console.log(JSON.stringify(positions, null, 2));

  // Get user history
  const history = await portfolioFetcher.getUserHistory('', 10);

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
