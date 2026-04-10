# Code Samples

Comprehensive code samples demonstrating the Limitless Exchange TypeScript SDK features.

## Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Configure your `.env` file:
```env
# Common example inputs
LIMITLESS_API_KEY=your_api_key_here
PRIVATE_KEY=your_private_key_here
MARKET_SLUG=bitcoin-2024
```

Optional example-runner overrides:
```env
# Only needed when you want a non-default environment
# API_URL=https://api.limitless.exchange
# WS_URL=wss://ws.limitless.exchange
# CHAIN_ID=8453

# Script-only toggles used by specific examples
# PLACE_ORDER=false
```

3. Run examples:
```bash
# From the root of limitless-exchange-sdk directory
npx tsx docs/code-samples/<example-file>.ts
```

## Clean Fluent API Examples

### Basic Fluent API
**File**: `fluent-api-example.ts`

Demonstrates the new clean fluent API for fetching user orders:

```typescript
// Clean fluent API - no need to pass marketSlug repeatedly!
const market = await marketFetcher.getMarket('bitcoin-2024');
const orders = await market.getUserOrders();
```

**Features**:
- Fetch market details
- Get user orders with fluent API
- Analyze order status distribution
- Compare old vs new API patterns

**Run**:
```bash
npx tsx docs/code-samples/fluent-api-example.ts
```

### Trading Workflow with Fluent API
**File**: `fluent-api-trading-workflow.ts`

Complete trading workflow using the fluent API:

```typescript
const market = await marketFetcher.getMarket(marketSlug);
const existingOrders = await market.getUserOrders();
// ... place orders ...
const updatedOrders = await market.getUserOrders();
```

**Features**:
- Fetch market and check existing orders
- Place new orders (optional)
- Monitor order updates
- Analyze order distribution

**Run**:
```bash
npx tsx docs/code-samples/fluent-api-trading-workflow.ts
```

## Authentication Examples

### Basic Authentication
**File**: `basic-auth.ts`

Simple authentication example using API key.

**Run**:
```bash
npx tsx docs/code-samples/basic-auth.ts
```

### Authentication with Retry
**File**: `auth-retry.ts`

Authentication with automatic retry on failures.

**Run**:
```bash
npx tsx docs/code-samples/auth-retry.ts
```

## API Key V3 / HMAC Examples

Dedicated examples for partner self-service tokens, HMAC auth, and delegated trading live under [`api-key-v3/`](./api-key-v3/README.md).

These values are used only by the example scripts. They are not required SDK globals. In normal SDK usage, you pass config directly to `HttpClient`, `WebSocketClient`, or the root `Client`.

### Token Derivation + HMAC Portfolio
**File**: `api-key-v3/api-tokens.ts`

Derive a scoped token from a Privy identity token, use HMAC auth against portfolio endpoints, list active derived tokens, and optionally revoke the token.

**Run**:
```bash
npx tsx docs/code-samples/api-key-v3/api-tokens.ts
```

### Partner Account Creation
**File**: `api-key-v3/partner-account.ts`

Create a partner-owned child account with `createServerWallet=true` using a scoped api-token.

**Run**:
```bash
npx tsx docs/code-samples/api-key-v3/partner-account.ts
```

### Partner E2E Flow
**File**: `api-key-v3/e2e-flow.ts`

Walk through the partner sequence end-to-end: read capabilities, derive an HMAC token, create a server-wallet child account, remind the operator to fund it, then place and cancel a delegated order.

**Run**:
```bash
npx tsx docs/code-samples/api-key-v3/e2e-flow.ts
```

### Partner E2E FOK Flow
**File**: `api-key-v3/e2e-fok-flow.ts`

Walk through the partner sequence end-to-end for delegated `FOK` trading: read capabilities, derive an HMAC token, create a server-wallet child account, remind the operator to fund it, then place a delegated `FOK` BUY order without a cleanup step.

**Run**:
```bash
npx tsx docs/code-samples/api-key-v3/e2e-fok-flow.ts
```

### Delegated Order Flow
**File**: `api-key-v3/delegated-order.ts`

Create delegated `GTC` orders with `onBehalfOf`, including `postOnly`, then cancel by order id and cancel all for the market.

**Run**:
```bash
npx tsx docs/code-samples/api-key-v3/delegated-order.ts
```

### Delegated FOK Order Flow
**File**: `api-key-v3/delegated-fok-order.ts`

Create a delegated `FOK` BUY order with `onBehalfOf` and inspect whether it matched immediately or auto-cancelled.

**Run**:
```bash
npx tsx docs/code-samples/api-key-v3/delegated-fok-order.ts
```

### WebSocket with HMAC
**File**: `api-key-v3/websocket-hmac.ts`

Connect to authenticated websocket channels using HMAC credentials instead of `X-API-Key`.

**Run**:
```bash
npx tsx docs/code-samples/api-key-v3/websocket-hmac.ts
```

## Market Data Examples

### Active Markets
**File**: `get-active-markets.ts`

Fetch and display active prediction markets with sorting and pagination.

**Run**:
```bash
npx tsx docs/code-samples/get-active-markets.ts
```

### Orderbook Data
**File**: `orderbook.ts`

Fetch and analyze market orderbook data.

**Run**:
```bash
npx tsx docs/code-samples/orderbook.ts
```

## Trading Examples

### CLOB Markets

#### FOK Orders (Market Orders)
**File**: `clob-fok-order.ts`

Place Fill-or-Kill (market) orders on CLOB markets.

**Run**:
```bash
npx tsx docs/code-samples/clob-fok-order.ts
```

#### GTC Orders (Limit Orders)
**File**: `clob-gtc-order.ts`

Place Good-Til-Cancelled (limit) orders on CLOB markets, including `postOnly`.

**Run**:
```bash
npx tsx docs/code-samples/clob-gtc-order.ts
```

#### FAK Orders (Fill-And-Kill Limit Orders)
**File**: `clob-fak-order.ts`

Place Fill-And-Kill limit orders on CLOB markets.

**Run**:
```bash
npx tsx docs/code-samples/clob-fak-order.ts
```

### NegRisk Markets

#### FOK Orders
**File**: `negrisk-fok-order.ts`

Place FOK orders on NegRisk submarkets.

**Run**:
```bash
npx tsx docs/code-samples/negrisk-fok-order.ts
```

#### GTC Orders
**File**: `negrisk-gtc-order.ts`

Place GTC orders on NegRisk submarkets.

**Run**:
```bash
npx tsx docs/code-samples/negrisk-gtc-order.ts
```

## Portfolio Examples

### Positions
**File**: `positions.ts`

Fetch and display portfolio positions.

**Run**:
```bash
npx tsx docs/code-samples/positions.ts
```

## WebSocket Examples

### WebSocket Events
**File**: `websocket-events.ts`

Complete WebSocket event handling example.

**Run**:
```bash
npx tsx docs/code-samples/websocket-events.ts
```

## Utility Examples

### Error Handling
**File**: `error-handling.ts`

Comprehensive error handling patterns.

**Run**:
```bash
npx tsx docs/code-samples/error-handling.ts
```

### Retry Patterns

#### Retry Wrapper
**File**: `retry-wrapper.ts`

Function wrapper for automatic retries.

**Run**:
```bash
npx tsx docs/code-samples/retry-wrapper.ts
```

#### Retry Decorator
**File**: `retry-decorator.ts`

Decorator pattern for retry logic.

**Run**:
```bash
npx tsx docs/code-samples/retry-decorator.ts
```

### Logging
**File**: `with-logging.ts`

HTTP client with custom logging.

**Run**:
```bash
npx tsx docs/code-samples/with-logging.ts
```

### Token Approvals
**File**: `setup-approvals.ts`

Setup token approvals for trading (USDC and Conditional Tokens).

**Run**:
```bash
npx tsx docs/code-samples/setup-approvals.ts
```

## Key Improvements

### Clean Fluent API

The new Market class provides a clean fluent API:

**Before** (old approach):
```typescript
const marketFetcher = new MarketFetcher(httpClient);
const orders = await marketFetcher.getUserOrders('market-slug');
```

**After** (new fluent API):
```typescript
const market = await marketFetcher.getMarket('market-slug');
const orders = await market.getUserOrders();  // ✨ Clean!
```

**Benefits**:
- ✅ No repetitive parameter passing
- ✅ Type-safe market context
- ✅ Intuitive object-oriented API
- ✅ Consistent with Python SDK

### Backward Compatibility

The old `marketFetcher.getUserOrders(slug)` method still works for backward compatibility.

## Common Patterns

### Fetching Market and Orders

```typescript
import { HttpClient, MarketFetcher } from '@limitless-exchange/sdk';

const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY,
});

const marketFetcher = new MarketFetcher(httpClient);

// Fetch market (returns Market class instance)
const market = await marketFetcher.getMarket('bitcoin-2024');

// Get user orders with clean fluent API
const orders = await market.getUserOrders();

// Access market properties
console.log(market.title);
console.log(market.tokens?.yes);
console.log(market.venue.exchange);

// Analyze orders
const openOrders = orders.filter(o => o.status === 'OPEN');
```

### Complete Trading Flow

```typescript
// 1. Fetch market
const market = await marketFetcher.getMarket(marketSlug);

// 2. Check existing orders
const existingOrders = await market.getUserOrders();

// 3. Setup order client (userData fetched automatically from profile)
const orderClient = new OrderClient({
  httpClient,
  wallet,
  marketFetcher,  // Share instance for venue caching
});

// 4. Place order
const order = await orderClient.createOrder({
  tokenId: market.tokens!.yes,
  price: 0.65,
  size: 10,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: market.slug,
});

// 5. Check updated orders
const updatedOrders = await market.getUserOrders();
```

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `LIMITLESS_API_KEY` | Your API key for authentication | For authenticated endpoints | - |
| `PRIVATE_KEY` | Wallet private key for order signing | For trading | - |
| `MARKET_SLUG` | Market slug for examples (works for both CLOB and NegRisk) | No | `bitcoin-2024` |
| `LIMITLESS_IDENTITY_TOKEN` | Privy identity token for partner api-key-v3 examples | No | - |
| `PARTNER_NAME` | Partner identifier used by api-key-v3 runtime files | No | `partner-a` |
| `API_URL` | Example-only API base URL override | No | `https://api.limitless.exchange` |
| `WS_URL` | Example-only websocket URL override | No | `wss://ws.limitless.exchange` |
| `CHAIN_ID` | Example-only chain override for approval / NegRisk scripts | No | `8453` (Base) |
| `PLACE_ORDER` | Enable actual order placement | No | `false` |

**Note**: User ID and fee rate are automatically fetched from your profile API on first order creation.

## Next Steps

- [Main Documentation](../README.md)
- [Markets Guide](../markets/README.md)
- [Trading Guide](../orders/README.md)
- [WebSocket Guide](../websocket/README.md)
- [Portfolio Guide](../portfolio/README.md)
