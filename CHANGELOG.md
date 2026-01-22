# Changelog

All notable changes to the Limitless Exchange TypeScript SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]

### Release Notes

This is the first stable, production-ready release of the Limitless Exchange TypeScript SDK, designated as a **Long-Term Support (LTS)** version. This release consolidates all features and improvements from pre-release versions (v0.x) into a stable, well-documented, and thoroughly tested SDK suitable for production use.

### Added

#### Core Features

- **Authentication**
  - API key authentication with X-API-Key header
  - Automatic loading from `LIMITLESS_API_KEY` environment variable
  - EIP-712 message signing for order creation (via `OrderSigner`)
  - `AuthenticationError` for authentication failure handling

- **Market Data Access**
  - `MarketFetcher` with intelligent venue caching system
  - Active markets retrieval with pagination and sorting options
  - Support for multiple sort strategies (lp_rewards, ending_soon, newest, high_value)
  - Market-specific data fetching with venue information
  - Real-time orderbook data access
  - Automatic venue data caching for performance optimization

- **Order Management**
  - `OrderClient` for comprehensive order operations
  - **GTC Orders** (Good-Til-Cancelled): `price` + `size` parameters
  - **FOK Orders** (Fill-Or-Kill): `makerAmount` parameter
    - BUY: makerAmount = total USDC to spend
    - SELL: makerAmount = number of shares to sell
  - Automatic EIP-712 order signing with venue.exchange integration
  - Dynamic venue resolution from cache or API
  - Order cancellation (single and batch operations)
  - Maker match tracking and order status monitoring
  - Tick alignment validation with helpful error messages

- **NegRisk Market Support**
  - Full support for group markets with multiple outcomes
  - Submarket navigation and trading
  - Proper venue and adapter handling for NegRisk markets
  - Dual approval system (exchange + adapter)
  - Comprehensive NegRisk trading examples

- **Portfolio & Positions**
  - `PortfolioFetcher` for position tracking
  - CLOB position data retrieval
  - Trading history access
  - Portfolio-wide analytics
  - Balance tracking across markets

- **WebSocket Integration**
  - `WebSocketClient` for real-time data streaming
  - Real-time orderbook updates
  - Position change notifications
  - Price update streaming
  - Event-based subscription system
  - Auto-reconnect functionality
  - Connection lifecycle management

- **Error Handling & Retry**
  - Comprehensive `APIError` exception handling with detailed context
  - `@retryOnErrors` decorator for automatic retry logic
  - `withRetry` wrapper function for flexible retry strategies
  - Configurable retry delays (fixed or exponential backoff)
  - Status code-based retry strategies
  - Callback hooks for monitoring retry attempts
  - Three retry approaches: decorator, wrapper function, or global client wrapper

- **Logging System**
  - `ConsoleLogger` with configurable log levels
  - Custom logger interface (`ILogger`)
  - Debug logging for venue operations
  - Request/response logging
  - Performance tracking and observability

- **Token Approval System**
  - Complete token approval setup script
  - CLOB market approval workflows
  - NegRisk market dual-approval requirements (exchange + adapter)
  - Web3 integration with ethers.js
  - Allowance checking functionality
  - ERC-20 (USDC) and ERC-1155 (Conditional Tokens) support

#### Performance & Optimization

- Automatic venue data caching to eliminate redundant API calls
- Connection pooling via axios for efficient HTTP requests
- API key authentication with automatic header injection
- Cache-aware market operations
- Dynamic venue resolution from cache or API
- Shared `MarketFetcher` instance pattern for optimal performance

#### Configuration & Customization

- Global and per-request custom HTTP headers
- Configurable signing configuration with auto-configuration fallback
- Environment-based configuration support
- Custom logger support
- Timeout configuration for HTTP requests
- Extensible authentication and signing logic
- TypeScript strict mode compliance

#### Type Safety & Developer Experience

- Full TypeScript support with comprehensive type definitions
- TSDoc documentation on all public APIs
- Type-safe order creation and management
- Type-safe market data access
- Exported enums for Side, OrderType, and constants
- Utility functions for contract address retrieval

#### Documentation

- Comprehensive README (450+ lines) covering all features
- **17 Production-Ready Code Samples**:
  - `basic-auth.ts` - API key authentication with portfolio data
  - `auth-retry.ts` - API authentication with retry logic
  - `with-logging.ts` - API requests with custom logging
  - `error-handling.ts` - Comprehensive error handling
  - `clob-fok-order.ts` - FOK market orders on CLOB
  - `clob-gtc-order.ts` - GTC limit orders on CLOB
  - `negrisk-fok-order.ts` - FOK orders on NegRisk markets
  - `negrisk-gtc-order.ts` - GTC orders on NegRisk markets
  - `get-active-markets.ts` - Market discovery with sorting
  - `orderbook.ts` - Orderbook fetching and analysis
  - `positions.ts` - Portfolio and position tracking
  - `retry-decorator.ts` - Retry decorator patterns
  - `retry-wrapper.ts` - Retry wrapper functions
  - `setup-approvals.ts` - Complete token approval workflow
  - `websocket-events.ts` - Real-time event handling
  - `websocket-orderbook.ts` - Live orderbook streaming
  - `websocket-trading.ts` - Real-time order monitoring

- **Comprehensive Documentation Guides**:
  - Complete SDK documentation overview
  - Trading & orders guide (200+ lines)
  - Market data guide
  - Portfolio & positions guide
  - WebSocket streaming guide with API key auth
  - Error handling & retry guide
  - Logging configuration guide

- **Documentation Quality Improvements**:
  - Accurate FOK order parameter documentation with clear BUY vs SELL semantics
  - Clear GTC order price parameter explanations
  - Comprehensive venue system documentation
  - Token approval requirements by market type (CLOB vs NegRisk)
  - Best practices for venue caching and performance
  - NegRisk trading workflow documentation
  - Common issues and solutions

### Changed

- Enhanced README with FOK order examples showing `makerAmount` semantics
- Improved error messages with actionable suggestions
- Better TypeScript type inference for order responses
- More detailed TSDoc comments throughout codebase

### Fixed

- None - this is the first stable release with all known issues resolved

### Architecture

- Modular design with clean separation of concerns
- Full TypeScript type safety throughout
- Async/await support for optimal performance
- Standards compliance with modern TypeScript practices
- Extensible component architecture
- Clean dependency injection patterns

### Quality Assurance

- Production-ready code quality
- Comprehensive error handling throughout
- Well-documented public APIs with TSDoc
- Consistent coding patterns and conventions
- Validated against live Base mainnet
- All 17 code samples tested and working
- Full test coverage for critical paths
- Lint-free codebase with strict TypeScript

---

## Pre-Release Versions

The following versions were development releases leading to v1.0.0:

## [0.0.3] - 2026-01 (Pre-release)

### Added

- WebSocket orderbook streaming
- Enhanced code samples with step-by-step comments
- NegRisk market trading examples
- Token approval setup script
- Comprehensive error handling in examples

### Changed

- Improved documentation for venue system
- Enhanced FOK order documentation in code samples
- Better error messages with context

### Fixed

- Minor type definition improvements
- Documentation link corrections

## [0.0.2] - 2025-12 (Pre-release)

### Added

- Venue caching system implementation
- MarketFetcher with intelligent caching
- OrderClient with dynamic venue resolution
- Retry mechanisms (decorator and wrapper)
- WebSocket client for real-time updates
- Portfolio fetcher for positions
- Comprehensive logging system
- Token approval documentation

### Changed

- Refactored order creation flow
- Enhanced TypeScript type definitions
- Improved error handling

### Fixed

- Session cookie management
- Order signing with correct venue addresses

## [0.0.1] - 2025-11 (Pre-release)

### Added

- Initial TypeScript SDK release
- Basic HTTP client with axios
- Authentication system with MessageSigner
- Order creation (GTC and FOK)
- Market data fetching
- Basic error handling
- Core type definitions
- TypeScript project setup

---

## LTS Support Policy

**v1.0.0 LTS** will receive:

- Security updates and critical bug fixes
- Compatibility maintenance with Limitless Exchange API
- Community support and issue resolution
- Documentation updates and improvements

For production deployments, we recommend using the LTS version for stability and long-term support.

---

## Migration Guide

### From v0.0.3 to v1.0.0

Important change to move from Cookie based auth to API-KEY due to /auth endpoint deprication in nearest future.

**Optional Updates**:

- Review new FOK order examples in README
- Check CHANGELOG for full feature list
- Update to LTS version in package.json: `"@limitless-exchange/sdk": "^1.0.0"`

### Key API Patterns

#### FOK Orders (makerAmount)

```typescript
// BUY: makerAmount = USDC to spend
await orderClient.createOrder({
  makerAmount: 50, // Spend $50 USDC
  side: Side.BUY,
  orderType: OrderType.FOK,
  // ...
});

// SELL: makerAmount = shares to sell
await orderClient.createOrder({
  makerAmount: 120, // Sell 120 shares
  side: Side.SELL,
  orderType: OrderType.FOK,
  // ...
});
```

#### GTC Orders (price + size)

```typescript
await orderClient.createOrder({
  price: 0.65, // Target price
  size: 100, // Number of shares
  side: Side.BUY,
  orderType: OrderType.GTC,
  // ...
});
```

#### Venue Caching

```typescript
// Best practice: Share MarketFetcher instance
const marketFetcher = new MarketFetcher(httpClient);
const orderClient = new OrderClient({
  httpClient,
  wallet,
  userData,
  marketFetcher,  // Shared instance enables caching
});

// Fetch market first to cache venue
await marketFetcher.getMarket('market-slug');

// Order creation uses cached venue
await orderClient.createOrder({ marketSlug: 'market-slug', ... });
```

---

## Support

For issues, questions, or contributions:

- GitHub Issues: [Create an issue](https://github.com/limitless-labs-group/limitless-exchange-ts-sdk/issues)
- Documentation: [View docs](./docs/README.md)
- Email: support@limitless.ai

## License

MIT License - see [LICENSE](./LICENSE) file for details.
