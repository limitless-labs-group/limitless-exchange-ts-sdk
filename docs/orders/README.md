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

The SDK supports two market types: CLOB and NegRisk. Each market uses a **venue system** that provides the correct smart contract addresses for order signing and token approvals.

### Venue System

**Important**: The SDK automatically fetches venue information from the API when you call `marketFetcher.getMarket()`. The venue contains:

- **exchange**: Contract address used as `verifyingContract` for EIP-712 order signing
- **adapter**: Contract address required for NegRisk/Grouped market SELL approvals

**Best Practice**: Always fetch market details before creating orders to cache venue data and avoid redundant API calls.

```typescript
import { MarketFetcher } from '@limitless-exchange/sdk';

const marketFetcher = new MarketFetcher(httpClient);

// Fetch market (automatically caches venue)
const market = await marketFetcher.getMarket('market-slug');

// Venue is now cached and will be used for order signing
console.log('Exchange:', market.venue.exchange);
console.log('Adapter:', market.venue.adapter);
```

### CLOB Markets (Single Outcome)

Standard prediction markets with a single outcome to trade.

**Default Contract Address** (Base mainnet):

```
0xa4409D988CA2218d956BeEFD3874100F444f0DC3
```

**Characteristics**:

- `marketType = "single"`
- One outcome per market
- Direct market slug for orders
- Simpler market structure
- Venue data returned from `/markets/:slug` API

**Token Approvals for CLOB**:

- **BUY orders**: USDC → `venue.exchange`
- **SELL orders**: CT → `venue.exchange`

### NegRisk Markets (Group Markets)

Group markets with multiple related outcomes traded together (e.g., "Largest Company 2025" with Apple, Microsoft, NVIDIA, etc.).

**Default Contract Address** (Base mainnet):

```
0x5a38afc17F7E97ad8d6C547ddb837E40B4aEDfC6
```

**Characteristics**:

- `marketType = "group"` (parent market)
- Multiple submarkets with `marketType = "single"`
- Use **submarket slug** for orders (NOT group slug)
- Each submarket has unique YES/NO token IDs
- Venue data returned from `/markets/:slug` API

**Token Approvals for NegRisk**:

- **BUY orders**: USDC → `venue.exchange`
- **SELL orders**: CT → `venue.exchange` **AND** `venue.adapter`

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

## Token Approvals Setup

**Important**: Before placing any orders, you must approve tokens for the exchange contracts. This is a **one-time setup** per wallet per venue.

### Why Approvals Are Needed

Smart contracts cannot transfer tokens from your wallet without explicit permission. Token approvals grant the exchange contracts permission to transfer:

- **USDC** when you place BUY orders
- **Conditional Tokens (CT)** when you place SELL orders

### Required Approvals

#### CLOB Markets

| Order Type | Token | Approval Target  | Method                             |
| ---------- | ----- | ---------------- | ---------------------------------- |
| **BUY**    | USDC  | `venue.exchange` | `approve(address, uint256)`        |
| **SELL**   | CT    | `venue.exchange` | `setApprovalForAll(address, bool)` |

#### NegRisk Markets

| Order Type | Token | Approval Target  | Method                             |
| ---------- | ----- | ---------------- | ---------------------------------- |
| **BUY**    | USDC  | `venue.exchange` | `approve(address, uint256)`        |
| **SELL**   | CT    | `venue.exchange` | `setApprovalForAll(address, bool)` |
| **SELL**   | CT    | `venue.adapter`  | `setApprovalForAll(address, bool)` |

⚠️ **NegRisk SELL orders require TWO approvals**: one for `venue.exchange` and one for `venue.adapter`.

### Quick Setup Script

Use the provided approval setup script:

```bash
# 1. Copy and configure environment
cp docs/code-samples/.env.example docs/code-samples/.env

# 2. Edit .env file:
#    - Set PRIVATE_KEY
#    - Set MARKET_SLUG (works for both CLOB and NegRisk markets)

# 3. Run approval setup
npx tsx docs/code-samples/setup-approvals.ts
```

The script will:

- Check current allowances
- Approve USDC for BUY orders
- Approve Conditional Tokens for SELL orders
- Handle NegRisk adapter approvals automatically
- Confirm all approvals are set correctly

### Manual Approval Example

For custom implementations, here's how to set up approvals manually:

```typescript
import { ethers } from 'ethers';
import { MarketFetcher, getContractAddress } from '@limitless-exchange/sdk';

async function setupApprovals(wallet: ethers.Wallet, marketSlug: string) {
  // 1. Fetch market to get venue addresses
  const httpClient = new HttpClient({ baseURL: 'https://api.limitless.exchange' });
  const marketFetcher = new MarketFetcher(httpClient);
  const market = await marketFetcher.getMarket(marketSlug);

  if (!market.venue) {
    throw new Error('Market does not have venue information');
  }

  // 2. Get token contract addresses
  const usdcAddress = getContractAddress('USDC'); // Native USDC on Base
  const ctfAddress = getContractAddress('CTF'); // Conditional Token Framework

  // 3. Create contract instances
  const usdc = new ethers.Contract(
    usdcAddress,
    ['function approve(address spender, uint256 amount) returns (bool)'],
    wallet
  );

  const ctf = new ethers.Contract(
    ctfAddress,
    ['function setApprovalForAll(address operator, bool approved)'],
    wallet
  );

  // 4. Approve USDC for BUY orders (unlimited approval)
  console.log('Approving USDC for venue.exchange...');
  const usdcTx = await usdc.approve(market.venue.exchange, ethers.MaxUint256);
  await usdcTx.wait();
  console.log('✅ USDC approved');

  // 5. Approve CT for SELL orders (all token IDs)
  console.log('Approving CT for venue.exchange...');
  const ctfTx = await ctf.setApprovalForAll(market.venue.exchange, true);
  await ctfTx.wait();
  console.log('✅ CT approved for venue.exchange');

  // 6. For NegRisk markets, also approve adapter
  if (market.negRiskRequestId) {
    console.log('Approving CT for venue.adapter (NegRisk)...');
    const adapterTx = await ctf.setApprovalForAll(market.venue.adapter, true);
    await adapterTx.wait();
    console.log('✅ CT approved for venue.adapter');
  }

  console.log('🎉 All approvals set!');
}
```

### Checking Current Allowances

Before setting approvals, check if they already exist:

```typescript
// Check USDC allowance
const usdcAllowance = await usdc.allowance(wallet.address, market.venue.exchange);
console.log(`USDC allowance: ${ethers.formatUnits(usdcAllowance, 6)} USDC`);

// Check CT approval for venue.exchange
const ctfApproved = await ctf.isApprovedForAll(wallet.address, market.venue.exchange);
console.log(`CT approved for exchange: ${ctfApproved}`);

// Check CT approval for venue.adapter (NegRisk only)
if (market.negRiskRequestId) {
  const adapterApproved = await ctf.isApprovedForAll(wallet.address, market.venue.adapter);
  console.log(`CT approved for adapter: ${adapterApproved}`);
}
```

### Important Notes

- **One-Time Setup**: Approvals are permanent (until revoked) and only need to be set once per wallet
- **Per Venue**: Different markets may have different venues - check `market.venue` for each market
- **Gas Costs**: Each approval requires a transaction and gas fees
- **Security**: Only approve trusted contracts. Limitless Exchange contracts are audited and secure
- **Unlimited Approval**: Using `ethers.MaxUint256` for USDC approval is safe and standard practice

### Common Issues

**"Insufficient allowance" error**:

- Solution: Run the approval setup script or manually approve tokens

**"Transfer amount exceeds allowance"**:

- For USDC: Your approval amount is too low
- Solution: Approve a higher amount or use `ethers.MaxUint256`

**NegRisk SELL order fails**:

- Possible cause: Missing `venue.adapter` approval
- Solution: Approve CT for both `venue.exchange` AND `venue.adapter`

**"ERC1155: caller is not owner nor approved"**:

- Your CT tokens are not approved for the exchange
- Solution: Call `setApprovalForAll(venue.exchange, true)`

## Creating Orders

### Prerequisites

You need three components to create orders:

```typescript
import { ethers } from 'ethers';
import { HttpClient, OrderClient, MarketFetcher, Side, OrderType } from '@limitless-exchange/sdk';

// 1. Setup HTTP client with API key authentication
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY, // Get from https://limitless.exchange
});

// 2. Initialize wallet for order signing (EIP-712)
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);

// 3. Fetch market details (caches venue for efficient order signing)
const marketFetcher = new MarketFetcher(httpClient);
const market = await marketFetcher.getMarket('market-slug');

// 4. Setup OrderClient with shared marketFetcher
// userData (userId, feeRateBps) is automatically fetched from profile API on first order
const orderClient = new OrderClient({
  httpClient,
  wallet,
  marketFetcher, // Share instance for venue caching
});
```

**Performance Tip**: Always call `marketFetcher.getMarket()` before `createOrder()` to cache venue data and eliminate redundant API calls.

### FOK Orders (Market Orders)

```typescript
// Buy with 50 USDC at market price
const buyOrder = await orderClient.createOrder({
  tokenId: 'YOUR_TOKEN_ID',
  makerAmount: 50, // 50 USDC to spend
  side: Side.BUY,
  orderType: OrderType.FOK,
  marketSlug: 'market-slug',
});

console.log('Buy order executed:', buyOrder.id);

// Sell 120 shares at market price
const sellOrder = await orderClient.createOrder({
  tokenId: 'YOUR_TOKEN_ID',
  makerAmount: 120, // 120 shares to sell
  side: Side.SELL,
  orderType: OrderType.FOK,
  marketSlug: 'market-slug',
});

console.log('Sell order executed:', sellOrder.id);
```

### GTC Orders (Limit Orders)

```typescript
// Place limit buy at specific price
const limitBuy = await orderClient.createOrder({
  tokenId: 'YOUR_TOKEN_ID',
  price: 0.6, // Exact price or better
  size: 20,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: 'market-slug',
});

console.log('Limit buy placed:', limitBuy.id);

// Place limit sell at specific price
const limitSell = await orderClient.createOrder({
  tokenId: 'YOUR_TOKEN_ID',
  price: 0.75, // Exact price or better
  size: 15,
  side: Side.SELL,
  orderType: OrderType.GTC,
  marketSlug: 'market-slug',
});

console.log('Limit sell placed:', limitSell.id);
```

## NegRisk Markets

NegRisk markets are **group markets** containing multiple related outcomes. Trading on NegRisk markets requires using the **submarket slug** and the correct contract address.

### Setup for NegRisk

```typescript
import { ethers } from 'ethers';
import { HttpClient, OrderClient, MarketFetcher, Side, OrderType } from '@limitless-exchange/sdk';

// 1. Setup HTTP client with API key authentication
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY, // Get from https://limitless.exchange
});

// 2. Initialize wallet for order signing (EIP-712)
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);

// 3. Setup OrderClient (userData fetched automatically from profile)
const orderClient = new OrderClient({
  httpClient,
  wallet,
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
  price: 0.5,
  size: 10,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: submarket.slug, // ← Use SUBMARKET slug (e.g., "apple-1746118069293")
});

// ❌ WRONG: Don't use group slug
// marketSlug: groupSlug  // This will fail!
```

### NegRisk FOK Orders

```typescript
// Market buy on NegRisk submarket
const buyOrder = await orderClient.createOrder({
  tokenId: detailedInfo.tokens.yes,
  makerAmount: 1.0, // 1 USDC to spend
  side: Side.BUY,
  orderType: OrderType.FOK,
  marketSlug: submarket.slug, // ← Submarket slug
});

console.log('Bought shares:', buyOrder.makerMatches);

// Market sell on NegRisk submarket
const sellOrder = await orderClient.createOrder({
  tokenId: detailedInfo.tokens.yes,
  makerAmount: 120.0, // 120.0 shares to sell
  side: Side.SELL,
  orderType: OrderType.FOK,
  marketSlug: submarket.slug, // ← Submarket slug
});

console.log('Sold shares:', sellOrder.makerMatches);
```

### NegRisk GTC Orders

```typescript
// Limit Order buy on NegRisk submarket
const limitBuy = await orderClient.createOrder({
  tokenId: detailedInfo.tokens.yes,
  price: 0.3,
  size: 20,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: submarket.slug, // ← Submarket slug
});

// Limit Order sell on NegRisk submarket
const limitSell = await orderClient.createOrder({
  tokenId: detailedInfo.tokens.yes,
  price: 0.8,
  size: 15,
  side: Side.SELL,
  orderType: OrderType.GTC,
  marketSlug: submarket.slug, // ← Submarket slug
});
```

### Key Differences: NegRisk vs CLOB

| Aspect              | CLOB Markets              | NegRisk Markets                         |
| ------------------- | ------------------------- | --------------------------------------- |
| **Market Type**     | `marketType = "single"`   | Group: `"group"`, Submarket: `"single"` |
| **Structure**       | Single outcome            | Group with multiple submarkets          |
| **Order Slug**      | Market slug directly      | **Submarket slug** (not group!)         |
| **Token IDs**       | One set per market        | Unique set per submarket                |
| **Venue Address**   | `venue.exchange` from API | `venue.exchange` from API               |
| **Fetching**        | Direct market fetch       | Group → submarkets array                |
| **Order Placement** | Same slug                 | **Must use submarket slug**             |

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

#### Using the Clean Fluent API

The Market class provides a clean fluent API for fetching user orders:

```typescript
// Clean fluent API - fetch market and get orders in one flow
const market = await marketFetcher.getMarket('market-slug');
const orders = await market.getUserOrders();

console.log(`Found ${orders.length} orders for ${market.title}`);

// Filter and analyze orders
const openOrders = orders.filter((o) => o.status === 'OPEN');
const filledOrders = orders.filter((o) => o.status === 'FILLED');

console.log(`Open: ${openOrders.length}, Filled: ${filledOrders.length}`);

// Display open orders
openOrders.forEach((order) => {
  console.log(`Order ${order.id}:`);
  console.log(`  Side: ${order.side}`);
  console.log(`  Price: ${order.price}`);
  console.log(`  Size: ${order.size}`);
  console.log(`  Filled: ${order.filled || 0}`);
  console.log(`  Remaining: ${order.size - (order.filled || 0)}`);
});
```

#### Alternative Approaches

```typescript
// Method 1: Using orderClient (traditional approach)
const openOrders = await orderClient.getOpenOrders({
  marketSlug: 'market-slug',
});

console.log('Open orders:', openOrders);

// Method 2: Using marketFetcher (backward compatible)
const orders = await marketFetcher.getUserOrders('market-slug');

// Get order details by ID
const orderDetails = await orderClient.getOrder('ORDER_ID');
console.log('Status:', orderDetails.status);
console.log('Filled:', orderDetails.filled);
console.log('Remaining:', orderDetails.size - orderDetails.filled);
```

### Order States

| State              | Description                                   |
| ------------------ | --------------------------------------------- |
| `OPEN`             | Order is on the orderbook, waiting to fill    |
| `PARTIALLY_FILLED` | Order has been partially filled               |
| `FILLED`           | Order has been completely filled              |
| `CANCELLED`        | Order was cancelled before filling            |
| `REJECTED`         | Order was rejected (insufficient funds, etc.) |

## Best Practices

### 1. Using the Clean Fluent API

The Market class provides a clean, object-oriented API for working with markets and orders:

```typescript
import { HttpClient, MarketFetcher } from '@limitless-exchange/sdk';

const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY,
});

const marketFetcher = new MarketFetcher(httpClient);

// Clean fluent API - no need to pass marketSlug repeatedly!
const market = await marketFetcher.getMarket('bitcoin-2024');

// Get user orders for this market
const orders = await market.getUserOrders();

// Access market properties
console.log('Market:', market.title);
console.log('Type:', market.marketType);
console.log('Orders:', orders.length);

// Filter orders by status
const activeOrders = orders.filter((o) => o.status === 'OPEN');
const completedOrders = orders.filter((o) => o.status === 'FILLED');

console.log(`Active: ${activeOrders.length}, Completed: ${completedOrders.length}`);
```

**Why use the fluent API?**

- **Cleaner code**: No repetitive parameter passing
- **Better DX**: More intuitive object-oriented approach
- **Type safety**: Market instance already has all context
- **Consistent with Python SDK**: Same API pattern across languages

**Comparison**:

```typescript
// ✅ CLEAN - Fluent API (recommended)
const market = await marketFetcher.getMarket('bitcoin-2024');
const orders = await market.getUserOrders();

// ❌ OLD - Requires passing marketSlug again
const orders = await marketFetcher.getUserOrders('bitcoin-2024');
```

### 2. Error Handling

```typescript
import { ApiError } from '@limitless-exchange/sdk';

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
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
      await new Promise((resolve) => setTimeout(resolve, this.minDelay));
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
