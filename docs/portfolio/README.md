# Portfolio & Positions

Complete guide to tracking positions and balances on the Limitless Exchange.

## Table of Contents

- [Overview](#overview)
- [Position Tracking](#position-tracking)
- [Balance Queries](#balance-queries)
- [Trade History](#trade-history)
- [Best Practices](#best-practices)

## Overview

The Portfolio API provides access to:

- **Positions**: Your current holdings across markets
- **Balances**: Available funds and locked collateral
- **Trade History**: Past orders and fills

**Authentication Required**: All portfolio endpoints require a valid session cookie.

## Position Tracking

### Setup

```typescript
import { ethers } from 'ethers';
import {
  HttpClient,
  MessageSigner,
  Authenticator,
  PositionFetcher
} from '@limitless-exchange/sdk';

// Authenticate
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange'
});

const signer = new MessageSigner(wallet);
const authenticator = new Authenticator(httpClient, signer);
const { sessionCookie, profile } = await authenticator.authenticate({
  client: 'eoa'
});

// Create authenticated HTTP client
const authedClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  headers: {
    cookie: \`limitless_session=\${sessionCookie}\`
  }
});

// Create position fetcher
const positionFetcher = new PositionFetcher(authedClient);
```

### Get All Positions

```typescript
// Get all your positions
const positions = await positionFetcher.getPositions();

console.log(\`You have \${positions.length} open positions\`);

positions.forEach(position => {
  console.log('Market:', position.marketSlug);
  console.log('Outcome:', position.outcome);
  console.log('Size:', position.size);
  console.log('Entry Price:', position.entryPrice);
  console.log('Current Value:', position.currentValue);
  console.log('P&L:', position.unrealizedPnL);
  console.log('---');
});
```

### Get Position for Specific Market

```typescript
const position = await positionFetcher.getPosition('market-slug');

if (position) {
  console.log('Position Size:', position.size);
  console.log('Entry Price:', position.entryPrice);
  console.log('Current Price:', position.currentPrice);
  
  // Calculate P&L
  const pnl = (position.currentPrice - position.entryPrice) * position.size;
  const pnlPercent = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;
  
  console.log('P&L:', pnl.toFixed(2), \`(\${pnlPercent.toFixed(2)}%)\`);
} else {
  console.log('No position in this market');
}
```

### Position Data Structure

```typescript
interface Position {
  marketSlug: string;      // Market identifier
  outcome: string;         // Outcome being held (YES/NO)
  size: number;            // Number of shares held
  entryPrice: number;      // Average entry price (0-1)
  currentPrice: number;    // Current market price (0-1)
  currentValue: number;    // Current position value
  unrealizedPnL: number;   // Unrealized profit/loss
  realizedPnL: number;     // Realized profit/loss
  createdAt: Date;         // Position opened timestamp
  updatedAt: Date;         // Last update timestamp
}
```

## Balance Queries

### Get Account Balances

```typescript
const balances = await positionFetcher.getBalances();

console.log('Available Balance:', balances.available);
console.log('Locked in Orders:', balances.locked);
console.log('Total Balance:', balances.total);
```

### Check Sufficient Balance

```typescript
async function hassufficientBalance(
  positionFetcher: PositionFetcher,
  requiredAmount: number
): Promise<boolean> {
  const balances = await positionFetcher.getBalances();
  return balances.available >= requiredAmount;
}

// Use before placing orders
const orderCost = 10 * 0.65; // 10 shares at 0.65
if (await hasSufficientBalance(positionFetcher, orderCost)) {
  console.log('Sufficient balance to place order');
} else {
  console.log('Insufficient balance');
}
```

## Trade History

### Get Trade History

```typescript
// Get all trades
const trades = await positionFetcher.getTradeHistory();

console.log(\`You have \${trades.length} trades\`);

trades.forEach(trade => {
  console.log('Market:', trade.marketSlug);
  console.log('Side:', trade.side); // BUY or SELL
  console.log('Price:', trade.price);
  console.log('Size:', trade.size);
  console.log('Total:', trade.total);
  console.log('Fee:', trade.fee);
  console.log('Time:', new Date(trade.timestamp));
  console.log('---');
});
```

### Filter Trades by Market

```typescript
const marketTrades = await positionFetcher.getTradeHistory({
  marketSlug: 'market-slug'
});

console.log(\`\${marketTrades.length} trades in this market\`);
```

### Filter Trades by Time Range

```typescript
const yesterday = Date.now() - 24 * 60 * 60 * 1000;

const recentTrades = await positionFetcher.getTradeHistory({
  startTime: yesterday,
  endTime: Date.now()
});

console.log(\`\${recentTrades.length} trades in last 24h\`);
```

### Calculate Trading Stats

```typescript
async function getTradingStats(positionFetcher: PositionFetcher) {
  const trades = await positionFetcher.getTradeHistory();

  // Total volume
  const totalVolume = trades.reduce((sum, trade) => sum + trade.total, 0);

  // Total fees paid
  const totalFees = trades.reduce((sum, trade) => sum + trade.fee, 0);

  // Win rate (simplified)
  const closedPositions = trades.filter(t => t.type === 'CLOSE');
  const profitableTrades = closedPositions.filter(t => t.pnl > 0);
  const winRate = (profitableTrades.length / closedPositions.length) * 100;

  // Average trade size
  const avgTradeSize = totalVolume / trades.length;

  return {
    totalTrades: trades.length,
    totalVolume: totalVolume.toFixed(2),
    totalFees: totalFees.toFixed(2),
    winRate: winRate.toFixed(1) + '%',
    avgTradeSize: avgTradeSize.toFixed(2),
  };
}

// Usage
const stats = await getTradingStats(positionFetcher);
console.table(stats);
```

## Best Practices

### 1. Real-time Position Updates

Use WebSocket for real-time position tracking instead of polling:

```typescript
import { WebSocketClient } from '@limitless-exchange/sdk';

// Create WebSocket client with authentication
const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  sessionCookie: sessionCookie,
  autoReconnect: true,
});

await wsClient.connect();

// Subscribe to position updates
await wsClient.subscribe('subscribe_positions', {
  marketSlugs: ['market-slug'] // or omit for all markets
});

// Listen to updates
wsClient.on('positions' as any, (data: any) => {
  console.log('Position update:', data);
  
  data.forEach((position: any) => {
    console.log(\`\${position.marketSlug}: \${position.size} shares\`);
  });
});
```

### 2. Position Monitoring

```typescript
class PositionMonitor {
  private positions = new Map<string, any>();

  async update(positionFetcher: PositionFetcher) {
    const positions = await positionFetcher.getPositions();
    
    positions.forEach(position => {
      const prev = this.positions.get(position.marketSlug);
      
      if (prev) {
        // Check for changes
        if (position.size !== prev.size) {
          console.log(\`Size changed: \${prev.size} → \${position.size}\`);
        }
        
        const pnlChange = position.unrealizedPnL - prev.unrealizedPnL;
        if (Math.abs(pnlChange) > 0.01) {
          console.log(\`P&L changed: \${pnlChange.toFixed(2)}\`);
        }
      }
      
      this.positions.set(position.marketSlug, position);
    });
  }
}

// Usage
const monitor = new PositionMonitor();
setInterval(() => monitor.update(positionFetcher), 5000);
```

### 3. Risk Management

```typescript
async function checkRiskLimits(positionFetcher: PositionFetcher) {
  const [positions, balances] = await Promise.all([
    positionFetcher.getPositions(),
    positionFetcher.getBalances()
  ]);

  // Calculate total exposure
  const totalExposure = positions.reduce(
    (sum, pos) => sum + pos.currentValue,
    0
  );

  // Calculate leverage
  const leverage = totalExposure / balances.total;

  // Check limits
  const MAX_LEVERAGE = 3;
  const MAX_POSITION_SIZE = 1000;
  const MAX_SINGLE_MARKET = 0.25; // 25% of total balance

  const warnings = [];

  if (leverage > MAX_LEVERAGE) {
    warnings.push(\`High leverage: \${leverage.toFixed(2)}x\`);
  }

  positions.forEach(pos => {
    if (pos.size > MAX_POSITION_SIZE) {
      warnings.push(\`Large position in \${pos.marketSlug}: \${pos.size} shares\`);
    }

    const positionPercent = pos.currentValue / balances.total;
    if (positionPercent > MAX_SINGLE_MARKET) {
      warnings.push(\`Over-concentrated in \${pos.marketSlug}: \${(positionPercent * 100).toFixed(1)}%\`);
    }
  });

  return {
    totalExposure: totalExposure.toFixed(2),
    leverage: leverage.toFixed(2),
    warnings,
  };
}

// Usage
const risk = await checkRiskLimits(positionFetcher);
if (risk.warnings.length > 0) {
  console.warn('Risk warnings:', risk.warnings);
}
```

### 4. Portfolio Summary

```typescript
async function getPortfolioSummary(positionFetcher: PositionFetcher) {
  const [positions, balances, trades] = await Promise.all([
    positionFetcher.getPositions(),
    positionFetcher.getBalances(),
    positionFetcher.getTradeHistory()
  ]);

  // Calculate totals
  const totalPositionValue = positions.reduce(
    (sum, pos) => sum + pos.currentValue,
    0
  );

  const totalUnrealizedPnL = positions.reduce(
    (sum, pos) => sum + pos.unrealizedPnL,
    0
  );

  const totalRealizedPnL = positions.reduce(
    (sum, pos) => sum + pos.realizedPnL,
    0
  );

  const totalPnL = totalUnrealizedPnL + totalRealizedPnL;

  // Trading stats
  const totalVolume = trades.reduce((sum, t) => sum + t.total, 0);
  const totalFees = trades.reduce((sum, t) => sum + t.fee, 0);

  return {
    // Balances
    availableBalance: balances.available.toFixed(2),
    lockedBalance: balances.locked.toFixed(2),
    totalBalance: balances.total.toFixed(2),
    
    // Positions
    openPositions: positions.length,
    totalPositionValue: totalPositionValue.toFixed(2),
    
    // P&L
    unrealizedPnL: totalUnrealizedPnL.toFixed(2),
    realizedPnL: totalRealizedPnL.toFixed(2),
    totalPnL: totalPnL.toFixed(2),
    
    // Trading
    totalTrades: trades.length,
    totalVolume: totalVolume.toFixed(2),
    totalFees: totalFees.toFixed(2),
  };
}

// Usage
const summary = await getPortfolioSummary(positionFetcher);
console.table(summary);
```

### 5. Error Handling

```typescript
import { ApiError } from '@limitless-exchange/sdk';

async function safeGetPositions(positionFetcher: PositionFetcher) {
  try {
    return await positionFetcher.getPositions();
  } catch (error) {
    if (error instanceof ApiError) {
      switch (error.status) {
        case 401:
          console.error('Session expired - re-authenticate');
          throw new Error('Authentication required');
        case 429:
          console.error('Rate limited - slow down');
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 5000));
          return await positionFetcher.getPositions();
        case 500:
          console.error('Server error - try again later');
          return []; // Return empty array as fallback
        default:
          throw error;
      }
    }
    throw error;
  }
}
```

### 6. Performance Tracking

```typescript
interface PerformanceMetrics {
  period: string;
  startingBalance: number;
  endingBalance: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

async function calculatePerformance(
  positionFetcher: PositionFetcher,
  startDate: Date,
  endDate: Date
): Promise<PerformanceMetrics> {
  const trades = await positionFetcher.getTradeHistory({
    startTime: startDate.getTime(),
    endTime: endDate.getTime()
  });

  const closedTrades = trades.filter(t => t.type === 'CLOSE');
  const wins = closedTrades.filter(t => t.pnl > 0);
  const losses = closedTrades.filter(t => t.pnl < 0);

  const totalWin = wins.reduce((sum, t) => sum + t.pnl, 0);
  const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  
  const balances = await positionFetcher.getBalances();
  const totalReturn = totalWin - totalLoss;

  return {
    period: \`\${startDate.toLocaleDateString()} - \${endDate.toLocaleDateString()}\`,
    startingBalance: balances.total - totalReturn,
    endingBalance: balances.total,
    totalReturn: totalReturn,
    totalReturnPercent: (totalReturn / (balances.total - totalReturn)) * 100,
    totalTrades: closedTrades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: (wins.length / closedTrades.length) * 100,
    avgWin: wins.length > 0 ? totalWin / wins.length : 0,
    avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
    profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin,
  };
}
```

## Examples

- [Checking Positions](../../examples/project-integration/src/positions.ts)
- [Real-time Position Tracking](../../examples/project-integration/src/websocket-trading.ts)

## Next Steps

- [Orders](../orders/README.md) - Create and manage orders
- [Markets](../markets/README.md) - Market data and orderbooks
- [WebSocket](../websocket/README.md) - Real-time position updates
