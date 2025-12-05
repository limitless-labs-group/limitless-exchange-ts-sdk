# API & Error Handling

Comprehensive guide to HTTP client usage, error handling, and retry mechanisms in the Limitless Exchange SDK.

## Table of Contents

- [HTTP Client](#http-client)
- [Error Handling](#error-handling)
- [Retry Mechanism](#retry-mechanism)
  - [Quick Start](#quick-start)
  - [Approach 1: Decorator](#approach-1-decorator-retryonerrors)
  - [Approach 2: Wrapper Function](#approach-2-wrapper-function-withretry)
  - [Approach 3: Retryable Client](#approach-3-retryable-client)
  - [Configuration Options](#configuration-options)
  - [Best Practices](#best-practices)

## HTTP Client

The `HttpClient` class provides a centralized HTTP client with cookie management and error handling.

```typescript
import { HttpClient } from '@limitless-exchange/sdk';

const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  timeout: 30000, // 30 seconds
  logger: myLogger, // Optional logger
});

// Set session cookie for authenticated requests
httpClient.setSessionCookie(sessionCookie);

// Make requests
const data = await httpClient.get('/markets');
await httpClient.post('/orders', orderData);
await httpClient.delete('/orders/123');
```

## Error Handling

The SDK throws `APIError` instances for HTTP errors, providing structured error information:

```typescript
import { APIError } from '@limitless-exchange/sdk';

try {
  await httpClient.post('/orders', orderData);
} catch (error) {
  if (error instanceof APIError) {
    console.error('API Error:', {
      message: error.message,
      status: error.status,
      data: error.data,
      url: error.url,
      method: error.method,
    });

    // Handle specific status codes
    if (error.status === 429) {
      console.log('Rate limited - should retry');
    } else if (error.status >= 500) {
      console.log('Server error - transient failure');
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Retry Mechanism

The SDK provides flexible retry logic to handle transient failures like rate limits (429), server errors (500, 502, 503), and network issues.

### Quick Start

```typescript
import { withRetry, RetryableClient, RetryConfig } from '@limitless-exchange/sdk';

// Quick wrapper approach
const result = await withRetry(
  async () => await orderClient.createOrder(orderData),
  { statusCodes: [429, 500], maxRetries: 3, delays: [2, 5, 10] }
);
```

### Approach 1: Decorator (`@retryOnErrors`)

**Best for**: Class methods that need transparent retry logic.

```typescript
import { retryOnErrors, HttpClient, OrderClient } from '@limitless-exchange/sdk';

class TradingService {
  private orderClient: OrderClient;

  constructor(orderClient: OrderClient) {
    this.orderClient = orderClient;
  }

  /**
   * Automatically retries on rate limits and server errors
   */
  @retryOnErrors({
    statusCodes: [429, 500, 502, 503],
    maxRetries: 3,
    delays: [2, 5, 10], // Wait 2s, then 5s, then 10s
    onRetry: (attempt, error, delay) => {
      console.log(`Retry ${attempt + 1} after ${delay}s: ${error.message}`);
    },
  })
  async placeOrder(orderData: any) {
    return await this.orderClient.createOrder(orderData);
  }

  /**
   * Exponential backoff for critical operations
   */
  @retryOnErrors({
    statusCodes: [429, 500, 502, 503, 504],
    maxRetries: 5,
    exponentialBase: 2, // 1s, 2s, 4s, 8s, 16s
    maxDelay: 30, // Cap at 30 seconds
  })
  async fetchCriticalData() {
    return await this.httpClient.get('/critical-endpoint');
  }
}
```

**Pros**:
- Clean, declarative syntax
- Transparent retry logic at method level
- Easy to configure per method

**Cons**:
- Requires TypeScript decorators (`"experimentalDecorators": true`)
- May need compilation step for certain environments

### Approach 2: Wrapper Function (`withRetry`)

**Best for**: One-off retries, functional programming style, or when decorators aren't available.

```typescript
import { withRetry, ConsoleLogger } from '@limitless-exchange/sdk';

const logger = new ConsoleLogger('info');

// Simple retry with fixed delays
const markets = await withRetry(
  async () => await marketFetcher.getActiveMarkets({ limit: 10 }),
  {
    statusCodes: [429, 500, 503],
    maxRetries: 3,
    delays: [1, 2, 3],
  },
  logger
);

// Exponential backoff
const orderResult = await withRetry(
  async () => await orderClient.createOrder(orderData),
  {
    statusCodes: [429, 500, 502, 503],
    maxRetries: 4,
    exponentialBase: 2,
    maxDelay: 30,
    onRetry: (attempt, error, delay) => {
      console.log(`⚠️ Retry attempt ${attempt + 1}`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Waiting ${delay}s before retry...`);
    },
  },
  logger
);
```

**Pros**:
- Works immediately without decorators
- Flexible - can wrap any async function
- Great for scripting and functional code

**Cons**:
- More verbose at call site
- Need to wrap each call explicitly

### Approach 3: Retryable Client

**Best for**: Adding retry logic to all HTTP requests globally.

```typescript
import { HttpClient, RetryableClient, RetryConfig, ConsoleLogger } from '@limitless-exchange/sdk';

// Create base HTTP client
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  logger: new ConsoleLogger('debug'),
});

// Wrap with retry logic
const retryConfig = new RetryConfig({
  statusCodes: [429, 500, 502, 503],
  maxRetries: 3,
  delays: [2, 5, 10],
});

const retryableClient = new RetryableClient(httpClient, retryConfig, logger);

// All requests automatically retry on configured status codes
const markets = await retryableClient.get('/markets');
const orderResult = await retryableClient.post('/orders', orderData);
await retryableClient.delete('/orders/123');
```

**Pros**:
- Global retry behavior for all requests
- Consistent retry logic across application
- Simple integration with existing code

**Cons**:
- Same retry logic for all requests
- Less granular control per endpoint

### Configuration Options

#### `RetryConfigOptions`

```typescript
interface RetryConfigOptions {
  /**
   * HTTP status codes to retry on
   * @default [429, 500, 502, 503, 504]
   */
  statusCodes?: number[];

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Fixed delays in seconds for each retry
   * If not provided, exponential backoff is used
   * @example [1, 2, 4] - wait 1s, then 2s, then 4s
   */
  delays?: number[];

  /**
   * Base for exponential backoff (delay = base^attempt)
   * @default 2
   */
  exponentialBase?: number;

  /**
   * Maximum delay in seconds for exponential backoff
   * @default 60
   */
  maxDelay?: number;

  /**
   * Optional callback called before each retry
   * @param attempt - Retry attempt number (0-based)
   * @param error - The error that triggered retry
   * @param delay - Delay in seconds before retry
   */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}
```

#### Default Retry Status Codes

The SDK retries on these HTTP status codes by default:

- **429**: Too Many Requests (rate limiting)
- **500**: Internal Server Error
- **502**: Bad Gateway
- **503**: Service Unavailable
- **504**: Gateway Timeout

#### Delay Strategies

**Fixed Delays**:
```typescript
{
  delays: [1, 2, 4, 8] // Wait 1s, 2s, 4s, 8s between retries
}
```

**Exponential Backoff**:
```typescript
{
  exponentialBase: 2,  // Doubles each time: 1s, 2s, 4s, 8s
  maxDelay: 30        // Cap at 30 seconds
}
```

**Linear Backoff**:
```typescript
{
  delays: [2, 2, 2, 2] // Constant 2s delay
}
```

### Best Practices

#### 1. Choose Appropriate Status Codes

```typescript
// For rate limiting and server errors
{ statusCodes: [429, 500, 502, 503] }

// For critical operations (include timeouts)
{ statusCodes: [429, 500, 502, 503, 504] }

// For read-only operations (more aggressive)
{ statusCodes: [404, 429, 500, 502, 503] }
```

#### 2. Set Reasonable Retry Limits

```typescript
// Quick operations (API calls)
{ maxRetries: 3, delays: [1, 2, 3] }

// Important operations
{ maxRetries: 5, exponentialBase: 2, maxDelay: 30 }

// Critical operations (with backoff)
{ maxRetries: 7, exponentialBase: 2, maxDelay: 60 }
```

#### 3. Use Callbacks for Monitoring

```typescript
{
  onRetry: (attempt, error, delay) => {
    // Log to monitoring service
    logger.warn('API retry triggered', {
      attempt: attempt + 1,
      error: error.message,
      status: (error as APIError).status,
      delay,
      timestamp: new Date().toISOString(),
    });

    // Alert on repeated failures
    if (attempt >= 3) {
      alertService.notify('Multiple API retry attempts');
    }
  }
}
```

#### 4. Combine with Circuit Breakers

For production systems, consider combining retry logic with circuit breakers:

```typescript
class ResilientOrderClient {
  private consecutiveFailures = 0;
  private circuitOpen = false;
  private circuitOpenUntil = 0;

  @retryOnErrors({
    statusCodes: [429, 500, 502, 503],
    maxRetries: 3,
    delays: [2, 5, 10],
  })
  async placeOrder(orderData: any) {
    // Circuit breaker check
    if (this.circuitOpen) {
      if (Date.now() < this.circuitOpenUntil) {
        throw new Error('Circuit breaker is open');
      }
      // Reset circuit after cooldown
      this.circuitOpen = false;
      this.consecutiveFailures = 0;
    }

    try {
      const result = await this.orderClient.createOrder(orderData);
      this.consecutiveFailures = 0; // Reset on success
      return result;
    } catch (error) {
      this.consecutiveFailures++;

      // Open circuit after 5 consecutive failures
      if (this.consecutiveFailures >= 5) {
        this.circuitOpen = true;
        this.circuitOpenUntil = Date.now() + 60000; // 60 second cooldown
      }

      throw error;
    }
  }
}
```

#### 5. Test Retry Behavior

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withRetry, APIError } from '@limitless-exchange/sdk';

describe('Retry behavior', () => {
  it('should retry on 429 and succeed', async () => {
    let attempt = 0;
    const mockFn = vi.fn(async () => {
      attempt++;
      if (attempt < 3) {
        throw new APIError('Rate limited', 429, {}, '/test', 'POST');
      }
      return { success: true };
    });

    const result = await withRetry(mockFn, {
      statusCodes: [429],
      maxRetries: 3,
      delays: [0, 0, 0], // No delay in tests
    });

    expect(result).toEqual({ success: true });
    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});
```

## Complete Example

```typescript
import {
  HttpClient,
  RetryableClient,
  RetryConfig,
  ConsoleLogger,
  OrderClient,
  MarketFetcher,
  withRetry,
  retryOnErrors,
} from '@limitless-exchange/sdk';

// Setup with logging
const logger = new ConsoleLogger('info');

const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  logger,
});

// Approach 1: Global retry for all requests
const retryConfig = new RetryConfig({
  statusCodes: [429, 500, 502, 503],
  maxRetries: 3,
  delays: [2, 5, 10],
  onRetry: (attempt, error, delay) => {
    logger.warn(`Retry ${attempt + 1} after ${delay}s`, { error: error.message });
  },
});

const retryableClient = new RetryableClient(httpClient, retryConfig, logger);

// Approach 2: Service with decorated methods
class TradingService {
  private orderClient: OrderClient;

  @retryOnErrors({
    statusCodes: [429, 500],
    maxRetries: 5,
    exponentialBase: 2,
    maxDelay: 30,
  })
  async placeOrder(orderData: any) {
    return await this.orderClient.createOrder(orderData);
  }
}

// Approach 3: One-off retry wrapper
const markets = await withRetry(
  async () => await marketFetcher.getActiveMarkets({ limit: 10 }),
  { statusCodes: [429, 500], maxRetries: 3, delays: [1, 2, 3] },
  logger
);
```

## See Also

- [Authentication with Retry](../auth/README.md#authentication-with-retry)
- [Error Handling Examples](../code-samples/error-handling.ts)
- [Retry Examples](../code-samples/auth-retry.ts)
