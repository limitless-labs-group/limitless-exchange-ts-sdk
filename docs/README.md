# Limitless Exchange TypeScript SDK Documentation

Official TypeScript SDK for the Limitless Exchange API.

## Table of Contents

- [Getting Started](#getting-started)
- [Clean Fluent API](./FLUENT_API.md) ✨ **New!**
- [Trading & Orders](./orders/README.md)
- [Markets](./markets/README.md)
- [Market Pages & Navigation](./market-pages/README.md)
- [Portfolio & Positions](./portfolio/README.md)
- [WebSocket Streaming](./websocket/README.md)
- [Error Handling & Retry](./api/README.md)
- [Logging](./logging/LOGGING.md)
- [Code Samples](./code-samples/README.md)

## Getting Started

### Installation

```bash
npm install @limitless-exchange/sdk
# or
yarn add @limitless-exchange/sdk
# or
pnpm add @limitless-exchange/sdk
```

### Quick Start

```typescript
import { ethers } from 'ethers';
import {
  HttpClient,
  OrderClient,
  MarketFetcher,
  PortfolioFetcher,
  Side,
  OrderType
} from '@limitless-exchange/sdk';

// Setup HTTP client with API key authentication
// API key is automatically loaded from LIMITLESS_API_KEY environment variable
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY, // Optional - auto-loads from env
});

// Initialize wallet for order signing (EIP-712)
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);

// Fetch market details (caches venue for efficient order signing)
const marketFetcher = new MarketFetcher(httpClient);
const market = await marketFetcher.getMarket('market-slug');

// Create order client (userData fetched automatically from profile)
const orderClient = new OrderClient({
  httpClient,
  wallet,
  marketFetcher, // Share instance for venue caching
});

// Place an order (uses cached venue - no extra API calls)
const order = await orderClient.createOrder({
  tokenId: market.tokens.yes,
  price: 0.65,
  size: 10,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: 'market-slug',
});

// Get user orders with clean fluent API
const orders = await market.getUserOrders();
console.log(`Found ${orders.length} orders`);
```

## ✨ What's New: Clean Fluent API

The SDK now features a clean, object-oriented fluent API that makes working with markets more intuitive:

```typescript
// Clean fluent API - no need to pass marketSlug repeatedly!
const market = await marketFetcher.getMarket('bitcoin-2024');
const orders = await market.getUserOrders();  // ✨ Clean!
```

**Benefits**:
- ✅ No repetitive parameter passing
- ✅ Type-safe market context
- ✅ Consistent with Python SDK
- ✅ Better developer experience

**Learn more**: [Clean Fluent API Guide](./FLUENT_API.md)

## Core Features

### 🔐 Authentication
- API key authentication (via environment variable or direct parameter)
- Partner HMAC-scoped API-token authentication
- EIP-712 wallet signing for order creation
- [Full Documentation](./api/README.md)

### 📊 Trading
- Market orders (FOK)
- Limit orders (GTC, FAK)
- `postOnly` support for GTC orders
- Order cancellation
- Order status tracking
- [Full Documentation](./orders/README.md)

### 💹 Markets
- Market discovery
- Orderbook data
- Market statistics
- Price feeds
- [Full Documentation](./markets/README.md)

### 💼 Portfolio
- Position tracking (CLOB and AMM)
- User history
- [Full Documentation](./portfolio/README.md)

### 🤝 Partner Server Wallets
- Partner child-account creation with `createServerWallet=true`
- Delegated order placement with `onBehalfOf`
- Server-wallet redeem and withdraw flows via `client.serverWallets`
- [Code Samples](./code-samples/api-key-v3/README.md)

### 🔌 WebSocket
- Real-time orderbook updates
- Live position tracking
- Transaction notifications
- [Full Documentation](./websocket/README.md)

### ⚡ Error Handling & Retry
- Automatic retry on rate limits (429)
- Configurable retry strategies
- Exponential backoff support
- Custom retry callbacks
- [Full Documentation](./api/README.md)

## Architecture

The SDK is organized into modules that mirror the API structure:

```
src/
├── orders/        # Order creation and management
├── markets/       # Market data and orderbooks
├── portfolio/     # Positions and user history
├── websocket/     # Real-time data streaming
├── api/           # Low-level API client with authentication
├── types/         # TypeScript type definitions
└── utils/         # Helper utilities
```

## Environment Configuration

Create a `.env` file:

```env
# Required
LIMITLESS_API_KEY=your_api_key_here
PRIVATE_KEY=your_private_key_here

# Optional - defaults shown
API_URL=https://api.limitless.exchange
CHAIN_ID=8453
```

## Error Handling

The SDK uses typed errors for better error handling:

```typescript
import { ApiError } from '@limitless-exchange/sdk';

try {
  await orderClient.createOrder(params);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error ${error.status}:`, error.message);
    console.error('Details:', error.data);
  }
}
```

## TypeScript Support

The SDK is written in TypeScript and includes comprehensive type definitions:

```typescript
import type {
  Order,
  Market,
  Position,
  OrderbookUpdate,
  WebSocketEvents
} from '@limitless-exchange/sdk';
```

## Examples

See the [code samples directory](./code-samples/README.md) for complete working examples:

- `basic-auth.ts` - Authentication basics
- `fluent-api-trading-workflow.ts` - Complete trading workflow
- `orderbook.ts` - Fetching orderbook data
- `positions.ts` - Portfolio and positions
- `websocket-events.ts` - Real-time trading
- `clob-fak-order.ts` - Fill-and-kill limit orders
- `api-key-v3/server-wallet-redeem-withdraw.ts` - HMAC server-wallet redeem and optional withdraw

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/limitless-exchange/ts-sdk/issues)
- **Documentation**: [https://docs.limitless.exchange](https://docs.limitless.exchange)
- **Discord**: [Join our community](https://discord.gg/limitless)

## License

MIT License - see [LICENSE](../LICENSE) for details
