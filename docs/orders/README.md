# Trading & Orders

Complete guide to creating and managing orders on the Limitless Exchange.

## Table of Contents

- [Overview](#overview)
- [Market Types](#market-types)
- [Order Types](#order-types)
- [Creating Orders](#creating-orders)
- [NegRisk Markets](#negrisk-markets)
- [Order Management](#order-management)
- [Best Practices](#best-practices)

## Overview

The Limitless Exchange supports two order types for both CLOB and NegRisk markets:

- **FOK (Fill or Kill)**: Market orders that execute immediately at the best available price or cancel entirely
- **GTC (Good Til Cancelled)**: Limit orders that remain on the orderbook until filled or manually cancelled

## Market Types

The SDK supports two market types, each requiring a different smart contract address for order signing:

### CLOB Markets (Single Outcome)

Standard prediction markets with a single outcome to trade.

**Contract Address** (Base mainnet):
```
0xa4409D988CA2218d956BeEFD3874100F444f0DC3
```

**Environment Variable**:
```bash
CLOB_CONTRACT_ADDRESS=0xa4409D988CA2218d956BeEFD3874100F444f0DC3
```

**Characteristics**:
- `marketType = "single"`
- One outcome per market
- Direct market slug for orders
- Simpler market structure

### NegRisk Markets (Group Markets)

Group markets with multiple related outcomes traded together (e.g., "Largest Company 2025" with Apple, Microsoft, NVIDIA, etc.).

**Contract Address** (Base mainnet):
```
0x5a38afc17F7E97ad8d6C547ddb837E40B4aEDfC6
```

**Environment Variable**:
```bash
NEGRISK_CONTRACT_ADDRESS=0x5a38afc17F7E97ad8d6C547ddb837E40B4aEDfC6
```

**Characteristics**:
- `marketType = "group"` (parent market)
- Multiple submarkets with `marketType = "single"`
- Use **submarket slug** for orders (NOT group slug)
- Each submarket has unique YES/NO token IDs

**Key Difference**: Always use the **submarket slug** when placing orders on NegRisk markets, not the group market slug.

## Order Types

### FOK - Fill or Kill (Market Orders)

Best for immediate execution when you want guaranteed fill at current market price.

**Characteristics**:
- Executes immediately at best available price
- No price slippage protection
- Fails if insufficient liquidity
- No partial fills - all or nothing

**Use Cases**:
- Quick entry/exit positions
- Market timing trades
- High liquidity markets

### GTC - Good Til Cancelled (Limit Orders)

Best for price-specific execution when you can wait for your target price.

**Characteristics**:
- Executes only at specified price or better
- Remains on orderbook until filled or cancelled
- Allows partial fills
- Full price control

**Use Cases**:
- Price targeting
- Patient position building
- Avoiding slippage

## Creating Orders

### Prerequisites

You need three components to create orders:

```typescript
import { ethers } from 'ethers';
import {
  HttpClient,
  MessageSigner,
  Authenticator,
  OrderClient,
  Side,
  OrderType,
  MarketType
} from '@limitless/exchange-ts-sdk';

// 1. Authenticate
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange'
});

const signer = new MessageSigner(wallet);
const authenticator = new Authenticator(httpClient, signer);
const { sessionCookie, profile } = await authenticator.authenticate({
  client: 'eoa'
});

// 2. Setup OrderClient
const orderClient = new OrderClient({
  httpClient,
  wallet,
  userData: {
    userId: profile.id,
    feeRateBps: profile.rank?.feeRateBps || 300,
  },
  marketType: MarketType.CLOB,
});
```

### FOK Orders (Market Orders)

```typescript
// Buy 10 shares at market price
const buyOrder = await orderClient.createOrder({
  tokenId: 'YOUR_TOKEN_ID',
  price: 0.65,  // Maximum price you're willing to pay
  size: 10,
  side: Side.BUY,
  orderType: OrderType.FOK,
  marketSlug: 'market-slug',
  marketType: MarketType.CLOB,
});

console.log('Buy order executed:', buyOrder.id);

// Sell 5 shares at market price
const sellOrder = await orderClient.createOrder({
  tokenId: 'YOUR_TOKEN_ID',
  price: 0.70,  // Minimum price you'll accept
  size: 5,
  side: Side.SELL,
  orderType: OrderType.FOK,
  marketSlug: 'market-slug',
  marketType: MarketType.CLOB,
});

console.log('Sell order executed:', sellOrder.id);
```

### GTC Orders (Limit Orders)

```typescript
// Place limit buy at specific price
const limitBuy = await orderClient.createOrder({
  tokenId: 'YOUR_TOKEN_ID',
  price: 0.60,  // Exact price or better
  size: 20,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: 'market-slug',
  marketType: MarketType.CLOB,
});

console.log('Limit buy placed:', limitBuy.id);

// Place limit sell at specific price
const limitSell = await orderClient.createOrder({
  tokenId: 'YOUR_TOKEN_ID',
  price: 0.75,  // Exact price or better
  size: 15,
  side: Side.SELL,
  orderType: OrderType.GTC,
  marketSlug: 'market-slug',
  marketType: MarketType.CLOB,
});

console.log('Limit sell placed:', limitSell.id);
```

## NegRisk Markets

NegRisk markets are **group markets** containing multiple related outcomes. Trading on NegRisk markets requires using the **submarket slug** and the correct contract address.

### Setup for NegRisk

```typescript
import { ethers } from 'ethers';
import {
  HttpClient,
  MessageSigner,
  Authenticator,
  OrderClient,
  MarketFetcher,
  Side,
  OrderType,
  MarketType,
} from '@limitless/exchange-ts-sdk';

// Set the NegRisk contract address
process.env.NEGRISK_CONTRACT_ADDRESS = '0x5a38afc17F7E97ad8d6C547ddb837E40B4aEDfC6';

// 1. Authenticate
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange'
});

const signer = new MessageSigner(wallet);
const authenticator = new Authenticator(httpClient, signer);
const authResult = await authenticator.authenticate({
  client: 'eoa'
});

const userData = {
  userId: (authResult.profile as any).id,
  feeRateBps: (authResult.profile as any).rank?.feeRateBps || 300,
};

// 2. Setup OrderClient for NegRisk
const orderClient = new OrderClient({
  httpClient,
  wallet,
  userData,
  marketType: MarketType.NEGRISK,  // ← Important: Use NEGRISK
});
```

### Fetching NegRisk Markets

```typescript
const marketFetcher = new MarketFetcher(httpClient);

// 1. Fetch the group market
const groupSlug = 'largest-company-end-of-2025-1746118069282';
const groupMarket = await marketFetcher.getMarket(groupSlug);

console.log('Group:', groupMarket.title);
console.log('Market Type:', groupMarket.marketType); // "group"

// 2. Access submarkets
const submarkets = groupMarket.markets; // Array of submarkets

submarkets.forEach((submarket: any) => {
  console.log('Submarket:', submarket.title);
  console.log('  Slug:', submarket.slug);
  console.log('  Type:', submarket.marketType); // "single"
  console.log('  Prices: Yes=${submarket.prices?.[0]}, No=${submarket.prices?.[1]}');
});

// 3. Get detailed submarket info (for token IDs)
const submarket = submarkets[0];
const detailedInfo = await marketFetcher.getMarket(submarket.slug);

console.log('Token IDs:');
console.log('  YES:', detailedInfo.tokens?.yes);
console.log('  NO:', detailedInfo.tokens?.no);
```

### Creating Orders on NegRisk Markets

**Important**: Use the **submarket slug**, NOT the group slug!

```typescript
// ✅ CORRECT: Use submarket slug
const order = await orderClient.createOrder({
  tokenId: detailedInfo.tokens.yes,
  price: 0.50,
  size: 10,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: submarket.slug,  // ← Use SUBMARKET slug (e.g., "apple-1746118069293")
});

// ❌ WRONG: Don't use group slug
// marketSlug: groupSlug  // This will fail!
```

### NegRisk FOK Orders

```typescript
// Market buy on NegRisk submarket
const buyOrder = await orderClient.createOrder({
  tokenId: detailedInfo.tokens.yes,
  amount: 1.0,  // 1 USDC to spend
  side: Side.BUY,
  orderType: OrderType.FOK,
  marketSlug: submarket.slug,  // ← Submarket slug
});

console.log('Bought shares:', buyOrder.makerMatches);

// Market sell on NegRisk submarket
const sellOrder = await orderClient.createOrder({
  tokenId: detailedInfo.tokens.yes,
  amount: 0.5,  // 0.5 USDC to receive
  side: Side.SELL,
  orderType: OrderType.FOK,
  marketSlug: submarket.slug,  // ← Submarket slug
});

console.log('Sold shares:', sellOrder.makerMatches);
```

### NegRisk GTC Orders

```typescript
// Limit buy on NegRisk submarket
const limitBuy = await orderClient.createOrder({
  tokenId: detailedInfo.tokens.yes,
  price: 0.30,
  size: 20,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: submarket.slug,  // ← Submarket slug
});

// Limit sell on NegRisk submarket
const limitSell = await orderClient.createOrder({
  tokenId: detailedInfo.tokens.yes,
  price: 0.80,
  size: 15,
  side: Side.SELL,
  orderType: OrderType.GTC,
  marketSlug: submarket.slug,  // ← Submarket slug
});
```

### Key Differences: NegRisk vs CLOB

| Aspect | CLOB Markets | NegRisk Markets |
|--------|--------------|-----------------|
| **Market Type** | `marketType = "single"` | Group: `"group"`, Submarket: `"single"` |
| **Structure** | Single outcome | Group with multiple submarkets |
| **Order Slug** | Market slug directly | **Submarket slug** (not group!) |
| **Token IDs** | One set per market | Unique set per submarket |
| **Contract** | `0xa4409D988CA2218d956BeEFD3874100F444f0DC3` | `0x5a38afc17F7E97ad8d6C547ddb837E40B4aEDfC6` |
| **MarketType** | `MarketType.CLOB` | `MarketType.NEGRISK` |
| **Fetching** | Direct market fetch | Group → submarkets array |
| **Order Placement** | Same slug | **Must use submarket slug** |

## Order Management

### Canceling Orders

```typescript
// Cancel a specific order
await orderClient.cancelOrder({
  orderId: 'ORDER_ID',
  marketSlug: 'market-slug',
});

console.log('Order cancelled');
```

### Checking Order Status

```typescript
// Get all open orders for a market
const openOrders = await orderClient.getOpenOrders({
  marketSlug: 'market-slug',
});

console.log('Open orders:', openOrders);

// Get order details
const orderDetails = await orderClient.getOrder('ORDER_ID');
console.log('Status:', orderDetails.status);
console.log('Filled:', orderDetails.filled);
console.log('Remaining:', orderDetails.size - orderDetails.filled);
```

### Order States

| State | Description |
|-------|-------------|
| `OPEN` | Order is on the orderbook, waiting to fill |
| `PARTIALLY_FILLED` | Order has been partially filled |
| `FILLED` | Order has been completely filled |
| `CANCELLED` | Order was cancelled before filling |
| `REJECTED` | Order was rejected (insufficient funds, etc.) |

## Best Practices

### 1. Error Handling

```typescript
import { ApiError } from '@limitless/exchange-ts-sdk';

try {
  const order = await orderClient.createOrder(params);
  console.log('Order created:', order.id);
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        console.error('Invalid order parameters:', error.message);
        break;
      case 401:
        console.error('Not authenticated - session expired');
        break;
      case 409:
        console.error('Insufficient balance');
        break;
      default:
        console.error('Order failed:', error.message);
    }
  }
}
```

### 2. Price Validation

```typescript
function validatePrice(price: number, orderType: OrderType): boolean {
  // Prices must be between 0 and 1 (0% to 100%)
  if (price <= 0 || price >= 1) {
    throw new Error('Price must be between 0 and 1');
  }

  // Ensure reasonable precision (max 4 decimal places)
  if (price.toString().split('.')[1]?.length > 4) {
    throw new Error('Price precision too high (max 4 decimals)');
  }

  return true;
}

// Use before creating orders
validatePrice(0.6543, OrderType.GTC); // OK
validatePrice(0.654321, OrderType.GTC); // Error: too precise
```

### 3. Size Validation

```typescript
function validateSize(size: number): boolean {
  if (size <= 0) {
    throw new Error('Size must be positive');
  }

  if (!Number.isInteger(size)) {
    throw new Error('Size must be a whole number');
  }

  return true;
}

// Use before creating orders
validateSize(10); // OK
validateSize(0.5); // Error: must be integer
```

### 4. Balance Checking

```typescript
// Check available balance before placing order
async function checkBalance(
  orderClient: OrderClient,
  side: Side,
  size: number,
  price: number
): Promise<boolean> {
  const balances = await orderClient.getBalances();
  
  if (side === Side.BUY) {
    const requiredBalance = size * price;
    return balances.available >= requiredBalance;
  } else {
    return balances.positions >= size;
  }
}

// Use before creating orders
const hasBalance = await checkBalance(orderClient, Side.BUY, 10, 0.65);
if (!hasBalance) {
  console.error('Insufficient balance for order');
  return;
}
```

### 5. Order Monitoring

```typescript
// Poll for order status
async function waitForOrderFill(
  orderClient: OrderClient,
  orderId: string,
  timeout = 30000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const order = await orderClient.getOrder(orderId);
    
    if (order.status === 'FILLED') {
      console.log('Order filled!');
      return true;
    }
    
    if (order.status === 'CANCELLED' || order.status === 'REJECTED') {
      console.log('Order not filled:', order.status);
      return false;
    }
    
    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('Order fill timeout');
  return false;
}
```

### 6. Rate Limiting

```typescript
// Avoid hitting rate limits
class OrderQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private minDelay = 100; // ms between orders

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      await fn();
      await new Promise(resolve => setTimeout(resolve, this.minDelay));
    }
    
    this.processing = false;
  }
}

// Usage
const orderQueue = new OrderQueue();

await orderQueue.add(() => orderClient.createOrder(params1));
await orderQueue.add(() => orderClient.createOrder(params2));
await orderQueue.add(() => orderClient.createOrder(params3));
```

## Examples

### CLOB Market Examples
- [FOK Order Creation](../../examples/project-integration/src/fok-order.ts) - Market orders on CLOB markets
- [GTC Order Creation](../../examples/project-integration/src/gtc-order.ts) - Limit orders on CLOB markets
- [Complete Trading Workflow](../../examples/project-integration/src/trading.ts) - Full trading example
- [WebSocket Order Monitoring](../../examples/project-integration/src/websocket-trading.ts) - Real-time order updates

### NegRisk Market Examples
- [NegRisk GTC Trading](../../examples/project-integration/src/negrisk-gtc-trading-example.ts) - Complete GTC order workflow for NegRisk markets
- [NegRisk FOK Orders](../../examples/project-integration/src/negrisk-fok-order.ts) - Market orders on NegRisk submarkets

**Run the examples:**
```bash
# CLOB examples
pnpm start:fok-order
pnpm start:gtc-order

# NegRisk examples
pnpm start:negrisk-trading
pnpm start:negrisk-fok
```

## Next Steps

- [Markets](../markets/README.md) - Market data and orderbooks
- [Portfolio](../portfolio/README.md) - Track positions and balances
- [WebSocket](../websocket/README.md) - Real-time order updates
