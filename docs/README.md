# Limitless Exchange TypeScript SDK Documentation

Official TypeScript SDK for the Limitless Exchange API.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](./auth/README.md)
- [Trading & Orders](./orders/README.md)
- [Markets](./markets/README.md)
- [Portfolio & Positions](./portfolio/README.md)
- [WebSocket Streaming](./websocket/README.md)
- [Error Handling & Retry](./api/README.md)
- [Logging](./logging/LOGGING.md)

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
  MessageSigner,
  Authenticator,
  OrderClient,
  MarketFetcher,
  Side,
  OrderType,
  MarketType
} from '@limitless-exchange/sdk';

// Initialize wallet
const wallet = new ethers.Wallet(PRIVATE_KEY);

// Setup HTTP client
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange'
});

// Authenticate
const signer = new MessageSigner(wallet);
const authenticator = new Authenticator(httpClient, signer);
const { sessionCookie, profile } = await authenticator.authenticate({
  client: 'eoa'
});

// Place an order
const orderClient = new OrderClient({
  httpClient,
  wallet,
  userData: {
    userId: profile.id,
    feeRateBps: profile.rank?.feeRateBps || 300,
  },
  marketType: MarketType.CLOB,
});

const order = await orderClient.createOrder({
  tokenId: 'YOUR_TOKEN_ID',
  price: 0.65,
  size: 10,
  side: Side.BUY,
  orderType: OrderType.GTC,
  marketSlug: 'market-slug',
  marketType: MarketType.CLOB,
});
```

## Core Features

### 🔐 Authentication
- EOA (Externally Owned Account) authentication
- Smart wallet support via Etherspot
- Automatic session management
- [Full Documentation](./auth/README.md)

### 📊 Trading
- Market orders (FOK)
- Limit orders (GTC)
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
- Position tracking
- Balance queries
- Trade history
- [Full Documentation](./portfolio/README.md)

### 🔌 WebSocket
- Real-time orderbook updates
- Live position tracking
- Order fill notifications
- Trade streaming
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
├── auth/          # Authentication and session management
├── orders/        # Order creation and management
├── markets/       # Market data and orderbooks
├── portfolio/     # Positions and balances
├── websocket/     # Real-time data streaming
├── api/           # Low-level API client
├── types/         # TypeScript type definitions
└── utils/         # Helper utilities
```

## Environment Configuration

Create a `.env` file:

```env
# Required
PRIVATE_KEY=your_private_key_here

# Optional - defaults shown
API_URL=https://api.limitless.exchange
CHAIN_ID=8453
CLOB_CONTRACT_ADDRESS=0xa4409D988CA2218d956BeEFD3874100F444f0DC3
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

See the [examples directory](../../examples/project-integration) for complete working examples:

- `basic-auth.ts` - Authentication basics
- `trading.ts` - Complete trading workflow
- `orderbook.ts` - Fetching orderbook data
- `positions.ts` - Portfolio and positions
- `websocket-trading.ts` - Real-time trading
- `websocket-orderbook.ts` - Live orderbook monitoring

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/limitless-exchange/ts-sdk/issues)
- **Documentation**: [https://docs.limitless.exchange](https://docs.limitless.exchange)
- **Discord**: [Join our community](https://discord.gg/limitless)

## License

MIT License - see [LICENSE](../LICENSE) for details
