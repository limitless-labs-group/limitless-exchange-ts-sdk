# Logging Guide

The SDK provides **optional logging** support through a simple interface pattern. Logging is completely opt-in with zero overhead by default.

## Quick Start

### No Logging (Default)

```typescript
import { Authenticator, HttpClient, MessageSigner } from '@limitless-exchange/sdk';

// No logging - zero overhead
const authenticator = new Authenticator(httpClient, signer);
```

### Development Logging

```typescript
import { Authenticator, HttpClient, MessageSigner, ConsoleLogger } from '@limitless-exchange/sdk';

// Simple console logging for development
const logger = new ConsoleLogger('debug'); // or 'info', 'warn', 'error'
const authenticator = new Authenticator(httpClient, signer, logger);

// Now SDK operations will log to console:
// [Limitless SDK] Starting authentication { client: 'eoa' }
// [Limitless SDK] Requesting signing message from API
// [Limitless SDK] Authentication successful { account: '0x...' }
```

## Production Logging

For production, implement your own logger using the `ILogger` interface:

### Winston Example

```typescript
import winston from 'winston';
import { ILogger } from '@limitless-exchange/sdk';

class WinstonLogger implements ILogger {
  constructor(private winston: winston.Logger) {}

  debug(message: string, meta?: Record<string, any>): void {
    this.winston.debug(message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.winston.info(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.winston.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    this.winston.error(message, { error: error?.message, stack: error?.stack, ...meta });
  }
}

// Create Winston instance
const winstonInstance = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'sdk-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'sdk.log' }),
  ],
});

// Use with SDK
const logger = new WinstonLogger(winstonInstance);
const authenticator = new Authenticator(httpClient, signer, logger);
```

### Pino Example

```typescript
import pino from 'pino';
import { ILogger } from '@limitless-exchange/sdk';

class PinoLogger implements ILogger {
  constructor(private pino: pino.Logger) {}

  debug(message: string, meta?: Record<string, any>): void {
    this.pino.debug(meta, message);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.pino.info(meta, message);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.pino.warn(meta, message);
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    this.pino.error({ err: error, ...meta }, message);
  }
}

// Create Pino instance
const pinoInstance = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Use with SDK
const logger = new PinoLogger(pinoInstance);
const authenticator = new Authenticator(httpClient, signer, logger);
```

### Datadog Example

```typescript
import { ILogger } from '@limitless-exchange/sdk';

class DatadogLogger implements ILogger {
  private ddLogs: any; // Datadog logger instance

  constructor(ddLogs: any) {
    this.ddLogs = ddLogs;
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.ddLogs.logger.debug(message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.ddLogs.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.ddLogs.logger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    this.ddLogs.logger.error(message, { error: error?.message, stack: error?.stack, ...meta });
  }
}

// Initialize Datadog
import { datadogLogs } from '@datadog/browser-logs';

datadogLogs.init({
  clientToken: 'YOUR_CLIENT_TOKEN',
  site: 'datadoghq.com',
  service: 'limitless-sdk',
  env: 'production',
});

// Use with SDK
const logger = new DatadogLogger(datadogLogs);
const authenticator = new Authenticator(httpClient, signer, logger);
```

### Sentry Example

```typescript
import * as Sentry from '@sentry/node';
import { ILogger } from '@limitless-exchange/sdk';

class SentryLogger implements ILogger {
  debug(message: string, meta?: Record<string, any>): void {
    Sentry.addBreadcrumb({
      message,
      level: 'debug',
      data: meta,
    });
  }

  info(message: string, meta?: Record<string, any>): void {
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      data: meta,
    });
  }

  warn(message: string, meta?: Record<string, any>): void {
    Sentry.captureMessage(message, {
      level: 'warning',
      extra: meta,
    });
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    Sentry.captureException(error || new Error(message), {
      extra: meta,
    });
  }
}

// Initialize Sentry
Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  environment: 'production',
});

// Use with SDK
const logger = new SentryLogger();
const authenticator = new Authenticator(httpClient, signer, logger);
```

### LogRocket Example

```typescript
import LogRocket from 'logrocket';
import { ILogger } from '@limitless-exchange/sdk';

class LogRocketLogger implements ILogger {
  debug(message: string, meta?: Record<string, any>): void {
    LogRocket.debug(message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    LogRocket.info(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    LogRocket.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    LogRocket.error(message, { error: error?.message, ...meta });
    if (error) {
      LogRocket.captureException(error);
    }
  }
}

// Initialize LogRocket
LogRocket.init('YOUR_APP_ID');

// Use with SDK
const logger = new LogRocketLogger();
const authenticator = new Authenticator(httpClient, signer, logger);
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
- Authentication start/success
- Session verification success
- Logout success

### Debug Level
- API requests
- Response processing
- Cookie extraction
- Signature generation

### Error Level
- Authentication failures
- API errors
- Session verification failures
- Logout failures

## Security Considerations

The SDK automatically sanitizes sensitive data:
- ✅ Private keys are never logged
- ✅ Full signatures are never logged
- ✅ Session tokens are truncated (first 20 chars only)
- ✅ Smart wallet addresses are logged (not sensitive)
- ✅ Account addresses are logged (public information)

## Performance Impact

- **No Logger**: Zero overhead, no performance impact
- **ConsoleLogger**: Minimal overhead (~1-5ms per operation in development)
- **Production Loggers**: Depends on implementation (typically <10ms)

## Best Practices

1. **Development**: Use `ConsoleLogger` with `debug` level
2. **Staging**: Use production logger with `info` level
3. **Production**: Use production logger with `warn` or `error` level
4. **Testing**: Use `NoOpLogger` or mock logger for unit tests

## Example: Environment-Based Logging

```typescript
import { ILogger, ConsoleLogger } from '@limitless-exchange/sdk';
import { WinstonLogger } from './winston-logger'; // Your implementation

function createLogger(): ILogger | undefined {
  if (process.env.NODE_ENV === 'production') {
    // Production: structured logging with Winston
    return new WinstonLogger(winstonInstance);
  } else if (process.env.NODE_ENV === 'development') {
    // Development: console logging
    return new ConsoleLogger('debug');
  } else {
    // Test: no logging
    return undefined; // Uses NoOpLogger internally
  }
}

const logger = createLogger();
const authenticator = new Authenticator(httpClient, signer, logger);
```

## Testing with Logging

```typescript
import { ILogger } from '@limitless-exchange/sdk';
import { vi } from 'vitest';

// Create mock logger for tests
const mockLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Use in tests
const authenticator = new Authenticator(httpClient, signer, mockLogger);

// Assert logging behavior
expect(mockLogger.info).toHaveBeenCalledWith('Starting authentication', {
  client: 'eoa',
  hasSmartWallet: false,
});
```
