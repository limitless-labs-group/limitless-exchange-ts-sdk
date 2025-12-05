# Limitless Exchange TypeScript SDK

A TypeScript SDK for interacting with the Limitless Exchange platform, providing type-safe access to CLOB and NegRisk prediction markets.

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

## Features

- ✅ **Authentication**: Simple wallet-based authentication with session management
- ✅ **Order Management**: Create, cancel, and manage orders on CLOB and NegRisk markets
- ✅ **Market Data**: Access real-time market data and orderbooks
- ✅ **NegRisk Markets**: Full support for group markets with multiple outcomes
- ✅ **Type Safety**: Full TypeScript support with comprehensive type definitions
- ✅ **TSDoc Documentation**: Complete API documentation with examples
- ✅ **WebSocket**: Real-time price and position updates

## Installation

```bash
npm install limitless-exchange-ts-sdk
# or
yarn add limitless-exchange-ts-sdk
# or
pnpm add limitless-exchange-ts-sdk
```

## Quick Start

### Fetching Active Markets (No Authentication Required)

```typescript
import { HttpClient, MarketFetcher } from 'limitless-exchange-ts-sdk';

// Create HTTP client (no authentication needed)
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
});

const marketFetcher = new MarketFetcher(httpClient);

// Get markets sorted by LP rewards
const markets = await marketFetcher.getActiveMarkets({
  limit: 8,
  sortBy: 'lp_rewards', // 'lp_rewards' | 'ending_soon' | 'newest' | 'volume' | 'liquidity'
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

```typescript
import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator } from 'limitless-exchange-ts-sdk';

// Create wallet from private key
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);

// Initialize SDK components
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
});

const signer = new MessageSigner(wallet);
const authenticator = new Authenticator(httpClient, signer);

// Authenticate
const result = await authenticator.authenticate({
  client: 'eoa', // 'eoa', 'base', or 'etherspot'
});

console.log('Session cookie:', result.sessionCookie);
console.log('Profile:', result.profile);
```

### ETHERSPOT Authentication (Smart Wallet)

```typescript
const result = await authenticator.authenticate({
  client: 'etherspot',
  smartWallet: '0x...', // Your smart wallet address
});
```

### Trading on NegRisk Markets

NegRisk markets are group markets with multiple related outcomes. Here's a quick example:

```typescript
import { OrderClient, MarketFetcher, MarketType, Side, OrderType } from 'limitless-exchange-ts-sdk';

// Set the NegRisk contract address
process.env.NEGRISK_CONTRACT_ADDRESS = '0x5a38afc17F7E97ad8d6C547ddb837E40B4aEDfC6';

// 1. Fetch NegRisk group market
const marketFetcher = new MarketFetcher(httpClient);
const groupMarket = await marketFetcher.getMarket('largest-company-end-of-2025-1746118069282');

// 2. Select a submarket (e.g., Apple)
const appleMarket = groupMarket.markets[0];
const marketDetails = await marketFetcher.getMarket(appleMarket.slug);

// 3. Create order client for NegRisk
const orderClient = new OrderClient({
  httpClient,
  wallet,
  userData: {
    userId: (authResult.profile as any).id,
    feeRateBps: (authResult.profile as any).rank?.feeRateBps || 300,
  },
  marketType: MarketType.NEGRISK, // Important: Use NEGRISK
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

## API Documentation

### Authentication

#### `MessageSigner`

Handles message signing for authentication.

```typescript
const signer = new MessageSigner(wallet);

// Create authentication headers
const headers = await signer.createAuthHeaders(signingMessage);

// Sign EIP-712 typed data
const signature = await signer.signTypedData(domain, types, value);
```

#### `Authenticator`

Manages the authentication flow.

```typescript
const authenticator = new Authenticator(httpClient, signer);

// Get signing message
const message = await authenticator.getSigningMessage();

// Authenticate
const result = await authenticator.authenticate({ client: 'eoa' });

// Verify authentication
const address = await authenticator.verifyAuth(sessionCookie);

// Logout
await authenticator.logout(sessionCookie);
```

#### `HttpClient`

HTTP client with cookie management.

```typescript
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  timeout: 30000,
});

// Set session cookie for authenticated requests
httpClient.setSessionCookie(sessionCookie);

// Make requests
const data = await httpClient.get('/endpoint');
await httpClient.post('/endpoint', { data });
```

## Documentation

For detailed documentation, see the [docs](./docs) directory:

- **[Complete Documentation](./docs/README.md)** - Full SDK documentation
- **[Authentication Guide](./docs/auth/README.md)** - Authentication and session management
- **[Trading & Orders](./docs/orders/README.md)** - Order creation, management, and NegRisk markets
- **[Market Data](./docs/markets/README.md)** - Market discovery and orderbook access
- **[Portfolio & Positions](./docs/portfolio/README.md)** - Position tracking and balances
- **[WebSocket Streaming](./docs/websocket/README.md)** - Real-time data updates
- **[Logging](./docs/logging/LOGGING.md)** - Logging configuration

## Code Examples

Production-ready code samples are available in [docs/code-samples](./docs/code-samples):

### Authentication Examples

- `basic-auth.ts` - Simple EOA authentication
- `smart-wallet.ts` - Etherspot smart wallet integration
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
├── auth/           # Authentication modules
├── api/            # HTTP client and API utilities
└── utils/          # Shared utilities and constants
```

## License

MIT - See [LICENSE](./LICENSE) file for details
