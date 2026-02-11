# Limitless Exchange TypeScript SDK

**v1.0.2 LTS (Long-Term Support)** | Production-Ready | Type-Safe | Fully Documented

A TypeScript SDK for interacting with the Limitless Exchange platform, providing type-safe access to CLOB and NegRisk prediction markets.

> 🎉 **v1.0.2 LTS Release**: This is the first stable, production-ready release with long-term support. Recommended for all production deployments. See [Changelog](#changelog) for details.

## ⚠️ Disclaimer

**USE AT YOUR OWN RISK**

This SDK is provided "as-is" without any warranties or guarantees. Trading on prediction markets involves financial risk. By using this SDK, you acknowledge that:

- You are responsible for testing the SDK thoroughly before using it in production
- The SDK authors are not liable for any financial losses or damages
- You should review and understand the code before executing any trades
- It is recommended to test all functionality on testnet or with small amounts first
- The SDK may contain bugs or unexpected behavior despite best efforts

**ALWAYS TEST BEFORE USING IN PRODUCTION WITH REAL FUNDS**

For production use, we strongly recommend:

1. Running comprehensive tests with your specific use case
2. Starting with small transaction amounts
3. Monitoring all transactions carefully
4. Having proper error handling and recovery mechanisms

**Feedback Welcome**: We encourage you to report any bugs, suggest improvements, or contribute to the project. Please submit issues or pull requests on our GitHub repository.

## 🌍 Geographic Restrictions

**Important**: Limitless restricts order placement from US locations due to regulatory requirements and compliance with international sanctions. Before placing orders, builders should verify their location complies with applicable regulations.

## Features

- ✅ **Authentication**: API key authentication with X-API-Key header
- ✅ **Order Management**: Create, cancel, and manage orders on CLOB and NegRisk markets
- ✅ **Market Data**: Access real-time market data and orderbooks
- ✅ **NegRisk Markets**: Full support for group markets with multiple outcomes
- ✅ **Error Handling & Retry**: Automatic retry logic for rate limits and transient failures
- ✅ **Type Safety**: Full TypeScript support with comprehensive type definitions
- ✅ **TSDoc Documentation**: Complete API documentation with examples
- ✅ **WebSocket**: Real-time price and position updates with API key auth

## Installation

```bash
npm install @limitless-exchange/sdk
# or
yarn add @limitless-exchange/sdk
# or
pnpm add @limitless-exchange/sdk
```

## Quick Start

### Fetching Active Markets (No Authentication Required)

```typescript
import { HttpClient, MarketFetcher } from '@limitless-exchange/sdk';

// Create HTTP client (no authentication needed)
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',

  // Optional: Add custom headers to all requests
  additionalHeaders: {
    'X-Custom-Header': 'my-value',
  },
});

const marketFetcher = new MarketFetcher(httpClient);

// Get markets sorted by LP rewards
const markets = await marketFetcher.getActiveMarkets({
  limit: 8,
  sortBy: 'lp_rewards', // 'lp_rewards' | 'ending_soon' | 'newest' | 'high_value'
});

console.log(`Found ${markets.data.length} of ${markets.totalMarketsCount} markets`);

// Pagination (page-based)
const page2 = await marketFetcher.getActiveMarkets({
  limit: 8,
  page: 2,
  sortBy: 'ending_soon',
});
```

See [examples/project-integration/src/active-markets.ts](./examples/project-integration/src/active-markets.ts) for more examples.

### Authentication

The SDK uses API keys for authentication. API keys can be obtained from your Limitless Exchange account settings(Click on User Profile).

```typescript
import { HttpClient } from '@limitless-exchange/sdk';

// Option 1: Automatic from environment variable (recommended)
// Set LIMITLESS_API_KEY in your .env file
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
});

// Option 2: Explicit API key
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY,
});

// All requests automatically include X-API-Key header
// For authenticated endpoints like portfolio, orders, etc.
```

**Environment Variables:**

Create a `.env` file:

```bash
# Required for authenticated endpoints
LIMITLESS_API_KEY=sk_live_your_api_key_here

# Optional: Private key for order signing (EIP-712)
PRIVATE_KEY=0x...
```

### Token Approvals

**Important**: Before placing orders, you must approve tokens for the exchange contracts. This is a **one-time setup** per wallet.

#### Required Approvals

**CLOB Markets:**

- **BUY orders**: Approve USDC → `market.venue.exchange`
- **SELL orders**: Approve Conditional Tokens → `market.venue.exchange`

**NegRisk Markets:**

- **BUY orders**: Approve USDC → `market.venue.exchange`
- **SELL orders**: Approve Conditional Tokens → **both** `market.venue.exchange` AND `market.venue.adapter`

#### Quick Setup

Run the approval setup script:

```bash
# Copy .env.example and configure your wallet
cp docs/code-samples/.env.example docs/code-samples/.env

# Edit .env and set your PRIVATE_KEY and market slug
# Then run the approval script
npx tsx docs/code-samples/setup-approvals.ts
```

#### Manual Approval Example

```typescript
import { ethers } from 'ethers';
import { MarketFetcher, getContractAddress } from '@limitless-exchange/sdk';

// 1. Fetch market to get venue addresses
const market = await marketFetcher.getMarket('market-slug');

// 2. Create contract instances
const usdc = new ethers.Contract(
  getContractAddress('USDC'),
  ['function approve(address spender, uint256 amount) returns (bool)'],
  wallet
);

const ctf = new ethers.Contract(
  getContractAddress('CTF'),
  ['function setApprovalForAll(address operator, bool approved)'],
  wallet
);

// 3. Approve USDC for BUY orders
await usdc.approve(market.venue.exchange, ethers.MaxUint256);

// 4. Approve CT for SELL orders
await ctf.setApprovalForAll(market.venue.exchange, true);

// 5. For NegRisk SELL orders, also approve adapter
if (market.negRiskRequestId) {
  await ctf.setApprovalForAll(market.venue.adapter, true);
}
```

For complete examples, see [docs/code-samples/setup-approvals.ts](./docs/code-samples/setup-approvals.ts).

### Trading on NegRisk Markets

NegRisk markets are group markets with multiple related outcomes. Here's a quick example:

```typescript
import { OrderClient, MarketFetcher, Side, OrderType } from '@limitless-exchange/sdk';

// 1. Fetch NegRisk group market
const marketFetcher = new MarketFetcher(httpClient);
const groupMarket = await marketFetcher.getMarket('largest-company-end-of-2025-1746118069282');

// 2. Select a submarket (e.g., Apple)
const appleMarket = groupMarket.markets[0];
const marketDetails = await marketFetcher.getMarket(appleMarket.slug);

// 3. Create order client (userData fetched automatically from profile)
const orderClient = new OrderClient({
  httpClient,
  wallet,
});

// 4. Place order on submarket (not group!)
const order = await orderClient.createOrder({
  tokenId: marketDetails.tokens.yes,
  price: 0.5,
  size: 10,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: appleMarket.slug, // Use submarket slug
});
```

**Important**: Always use the **submarket slug** for NegRisk orders, not the group market slug!

For more details, see the [NegRisk Trading Guide](./docs/orders/README.md#negrisk-markets).

### FOK Orders (Fill-or-Kill Market Orders)

FOK orders execute immediately at the best available price or cancel entirely. Unlike GTC orders that use `price` + `size`, FOK orders use `makerAmount`.

**Parameter Semantics**:

- **BUY**: `makerAmount` = total USDC to spend
- **SELL**: `makerAmount` = number of shares to sell

```typescript
import { OrderClient, Side, OrderType } from '@limitless-exchange/sdk';

// BUY FOK - spend 50 USDC at market price
const buyOrder = await orderClient.createOrder({
  tokenId: marketDetails.tokens.yes,
  makerAmount: 50, // 50 USDC to spend
  side: Side.BUY,
  orderType: OrderType.FOK,
  marketSlug: 'market-slug',
});

// SELL FOK - sell 120 shares at market price
const sellOrder = await orderClient.createOrder({
  tokenId: marketDetails.tokens.no,
  makerAmount: 120, // 120 shares to sell
  side: Side.SELL,
  orderType: OrderType.FOK,
  marketSlug: 'market-slug',
});

// Check execution
if (buyOrder.makerMatches && buyOrder.makerMatches.length > 0) {
  console.log(`Order filled: ${buyOrder.makerMatches.length} matches`);
} else {
  console.log('Order cancelled (no liquidity)');
}
```

**Key Differences from GTC**:

- FOK uses `makerAmount` (not `price` + `size`)
- Executes immediately or cancels (no orderbook placement)
- All-or-nothing execution (no partial fills)
- Best for immediate execution at market price

For complete examples, see [docs/code-samples/clob-fok-order.ts](./docs/code-samples/clob-fok-order.ts).

### Error Handling & Retry

The SDK provides automatic retry logic for handling transient failures like rate limits and server errors:

```typescript
import { withRetry, retryOnErrors } from '@limitless-exchange/sdk';

// Option 1: Wrapper function approach
const result = await withRetry(async () => await orderClient.createOrder(orderData), {
  statusCodes: [429, 500, 503], // Retry on rate limits and server errors
  maxRetries: 3,
  delays: [2, 5, 10], // Wait 2s, then 5s, then 10s
  onRetry: (attempt, error, delay) => {
    console.log(`Retry ${attempt + 1} after ${delay}s: ${error.message}`);
  },
});

// Option 2: Decorator approach (requires experimentalDecorators: true)
class TradingService {
  @retryOnErrors({
    statusCodes: [429, 500, 503],
    maxRetries: 3,
    exponentialBase: 2, // Exponential backoff: 1s, 2s, 4s
    maxDelay: 30,
  })
  async placeOrder(orderData: any) {
    return await this.orderClient.createOrder(orderData);
  }
}
```

**Key Features**:

- Automatic retry on configurable status codes (429, 500, 502, 503, 504)
- Fixed delays or exponential backoff strategies
- Callback hooks for monitoring retry attempts
- Three approaches: decorator, wrapper function, or global client wrapper

For detailed documentation, see the [Error Handling & Retry Guide](./docs/api/README.md).

## API Documentation

### Authentication

#### `HttpClient`

HTTP client with API key authentication.

```typescript
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY, // Optional - auto-loads from env
  timeout: 30000,
});

// Set or update API key
httpClient.setApiKey('sk_live_...');

// Make requests - X-API-Key header automatically included
const data = await httpClient.get('/endpoint');
await httpClient.post('/endpoint', { data });
```

## Documentation

For detailed documentation, see the [docs](./docs) directory:

- **[Complete Documentation](./docs/README.md)** - Full SDK documentation
- **[Authentication Guide](./docs/api/README.md)** - API key authentication and HTTP client
- **[Trading & Orders](./docs/orders/README.md)** - Order creation, management, and NegRisk markets
- **[Market Data](./docs/markets/README.md)** - Market discovery and orderbook access
- **[Portfolio & Positions](./docs/portfolio/README.md)** - Position tracking and user history
- **[WebSocket Streaming](./docs/websocket/README.md)** - Real-time data updates
- **[Error Handling & Retry](./docs/api/README.md)** - API error handling and retry mechanisms
- **[Logging](./docs/logging/LOGGING.md)** - Logging configuration

## Code Examples

Production-ready code samples are available in [docs/code-samples](./docs/code-samples):

### Authentication Examples

- `basic-auth.ts` - API key authentication setup
- `with-logging.ts` - Authentication with custom logging
- `auth-retry.ts` - Authentication with retry logic
- `error-handling.ts` - Comprehensive error handling

### Trading Examples

**CLOB Markets:**

- `clob-fok-order.ts` - Fill-or-Kill market orders
- `clob-gtc-order.ts` - Good-Til-Cancelled limit orders

**NegRisk Markets:**

- `negrisk-fok-order.ts` - FOK orders on group markets
- `negrisk-gtc-trading-example.ts` - Complete NegRisk trading workflow

### Market Data Examples

- `get-active-markets.ts` - Fetching active markets with sorting and pagination
- `orderbook.ts` - Fetching and analyzing orderbooks
- `positions.ts` - Portfolio and position tracking
- `trading.ts` - Complete trading workflow

### Real-Time Examples

- `websocket-trading.ts` - Real-time order monitoring
- `websocket-orderbook.ts` - Live orderbook streaming

## Development

### Build

```bash
pnpm install
pnpm build
```

### Test

```bash
pnpm test
pnpm test:coverage
```

### Lint

```bash
pnpm lint
pnpm format
```

## Project Structure

```
src/
├── types/          # TypeScript type definitions
│   ├── markets.ts  # Market and active markets types
│   ├── orders.ts   # Order types
│   ├── auth.ts     # User profile types
│   └── ...
├── api/            # HTTP client and API utilities
│   ├── http.ts     # HTTP client with API key auth
│   ├── errors.ts   # Error handling
│   └── retry.ts    # Retry logic
├── markets/        # Market data modules
│   ├── fetcher.ts  # Market and orderbook fetching
│   └── index.ts
├── orders/         # Order management
│   └── client.ts   # Order creation and management
├── portfolio/      # Portfolio and positions
│   └── fetcher.ts
├── websocket/      # Real-time data streaming
│   └── client.ts
├── api/            # HTTP client and API utilities
│   ├── http.ts     # HTTP client
│   └── errors.ts   # API error handling
└── utils/          # Shared utilities and constants

tests/
├── auth/           # Authentication tests
└── markets/        # Market fetcher tests
    └── fetcher.test.ts //etc.

docs/
├── code-samples/   # Production-ready examples
│   ├── get-active-markets.ts
│   ├── clob-fok-order.ts
│   └── ...
└── */              # Documentation guides

```

## Changelog

### v1.0.2 (LTS - Long-Term Support Release)

**Release Date**: January 2026

This is the first stable, production-ready release of the Limitless Exchange TypeScript SDK, designated as a Long-Term Support (LTS) version.

#### Highlights

- ✅ **Production-Ready**: Thoroughly tested and validated against Base mainnet
- 🔒 **Type-Safe**: Full TypeScript support with comprehensive type definitions
- 📚 **Well-Documented**: 17 production-ready code samples + comprehensive guides
- ⚡ **Performance Optimized**: Venue caching system and connection pooling
- 🔄 **Robust Error Handling**: Automatic retry logic with multiple strategies
- 🌐 **Real-Time Updates**: WebSocket support for orderbook and position streaming
- 🎯 **NegRisk Support**: Full support for group markets with multiple outcomes

#### Core Features

- **Authentication**: API key authentication, EIP-712 signing, EOA support
- **Market Data**: Active markets with sorting, orderbook access, venue caching
- **Order Management**: GTC and FOK orders, tick alignment, automatic signing
- **Portfolio**: Position tracking, user history
- **WebSocket**: Real-time orderbook, price updates, event streaming
- **Error Handling**: Decorator and wrapper retry patterns, configurable strategies
- **Token Approvals**: Complete setup script, CLOB and NegRisk workflows

#### Documentation Enhancements (v1.0.2)

- Added FOK order examples to README with clear `makerAmount` semantics
- Created comprehensive CHANGELOG.md following Keep a Changelog format
- All 17 code samples include step-by-step comments and error handling
- Detailed guides for authentication, trading, markets, portfolio, and WebSocket

For complete release notes, see [CHANGELOG.md](./CHANGELOG.md).

---

### Pre-Release Versions

- **v0.0.3** - WebSocket streaming, enhanced code samples, NegRisk examples
- **v0.0.2** - Venue caching, retry mechanisms, portfolio fetcher
- **v0.0.1** - Initial release with core functionality

---

## LTS Support Policy

**v1.0.2 LTS** will receive:

- Security updates and critical bug fixes
- Compatibility maintenance with Limitless Exchange API
- Community support and issue resolution
- Documentation updates and improvements
- Long-term stability for production deployments

**Recommended for production use.** We commit to maintaining backward compatibility and providing timely security updates for this LTS release.

## License

MIT - See [LICENSE](./LICENSE) file for details
