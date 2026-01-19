# Logging Guide

The SDK provides **optional logging** support through a simple interface pattern. Logging is completely opt-in with zero overhead by default.

## Quick Start

### No Logging (Default)

```typescript
import { HttpClient, OrderClient } from '@limitless-exchange/sdk';

// No logging - zero overhead
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY,
});
```

### Development Logging

```typescript
import { HttpClient, OrderClient, ConsoleLogger } from '@limitless-exchange/sdk';

// Simple console logging for development
const logger = new ConsoleLogger('debug'); // or 'info', 'warn', 'error'

const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY,
  logger,
});

// Now SDK operations will log to console:
// [Limitless SDK] → GET https://api.limitless.exchange/markets
// [Limitless SDK] ✓ 200 GET /markets
```

## Logger Levels

```typescript
// Debug: All logs (verbose)
const logger = new ConsoleLogger('debug');

// Info: Important operations only
const logger = new ConsoleLogger('info');

// Warn: Warnings and errors only
const logger = new ConsoleLogger('warn');

// Error: Errors only
const logger = new ConsoleLogger('error');
```

## Production Logging

For production, implement your own logger using the `ILogger` interface:

```typescript
import { ILogger } from '@limitless-exchange/sdk';

class CustomLogger implements ILogger {
  debug(message: string, meta?: Record<string, any>): void {
    // Your debug logging implementation
    console.debug(message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    // Your info logging implementation
    console.info(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    // Your warning logging implementation
    console.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    // Your error logging implementation
    console.error(message, { error: error?.message, stack: error?.stack, ...meta });
  }
}

// Use with SDK
const logger = new CustomLogger();
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY,
  logger,
});
```

## Logger Interface

```typescript
export interface ILogger {
  /**
   * Log debug information (verbose, development only)
   */
  debug(message: string, meta?: Record<string, any>): void;

  /**
   * Log informational messages
   */
  info(message: string, meta?: Record<string, any>): void;

  /**
   * Log warning messages
   */
  warn(message: string, meta?: Record<string, any>): void;

  /**
   * Log error messages
   */
  error(message: string, error?: Error, meta?: Record<string, any>): void;
}
```

## What Gets Logged

### Info Level
- API requests (method + URL)
- Successful responses (status code)
- Order creation/cancellation
- Position updates

### Debug Level
- Request headers (API key redacted)
- Request body data
- Response data
- WebSocket events

### Error Level
- API errors (with status code and response data)
- Network errors
- WebSocket connection errors

## Security Considerations

The SDK automatically sanitizes sensitive data:
- ✅ API keys are redacted in logs (shown as `***`)
- ✅ Private keys are never logged
- ✅ Account addresses are logged (public information)

## Performance Impact

- **No Logger**: Zero overhead, no performance impact
- **ConsoleLogger**: Minimal overhead (~1-5ms per operation in development)
- **Custom Loggers**: Depends on implementation (typically <10ms)

## Best Practices

1. **Development**: Use `ConsoleLogger` with `debug` level
2. **Staging**: Use `ConsoleLogger` with `info` level
3. **Production**: Use custom logger with `warn` or `error` level
4. **Testing**: Don't pass logger (defaults to no-op)

## Example: Environment-Based Logging

```typescript
import { ILogger, ConsoleLogger } from '@limitless-exchange/sdk';

function createLogger(): ILogger | undefined {
  if (process.env.NODE_ENV === 'production') {
    // Production: errors only
    return new ConsoleLogger('error');
  } else if (process.env.NODE_ENV === 'development') {
    // Development: verbose logging
    return new ConsoleLogger('debug');
  } else {
    // Test: no logging
    return undefined;
  }
}

const logger = createLogger();
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY,
  logger,
});
```

## Complete Example

```typescript
import {
  HttpClient,
  OrderClient,
  MarketFetcher,
  ConsoleLogger,
} from '@limitless-exchange/sdk';
import { ethers } from 'ethers';

// Create logger
const logger = new ConsoleLogger('info');

// Initialize HTTP client with logger
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  apiKey: process.env.LIMITLESS_API_KEY,
  logger,
});

// All SDK components will use this logger
const marketFetcher = new MarketFetcher(httpClient, logger);
const orderClient = new OrderClient({
  httpClient,
  wallet: new ethers.Wallet(process.env.PRIVATE_KEY!),
  logger,
});

// Logs will show all operations
const markets = await marketFetcher.getActiveMarkets({ limit: 10 });
// [Limitless SDK] → GET https://api.limitless.exchange/markets?limit=10
// [Limitless SDK] ✓ 200 GET /markets?limit=10

const order = await orderClient.createGTCOrder({
  marketId: 'market-123',
  side: 'BUY',
  price: 0.5,
  amount: 10,
});
// [Limitless SDK] → POST https://api.limitless.exchange/orders
// [Limitless SDK] ✓ 201 POST /orders
```
