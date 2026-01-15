# Authentication

Complete guide to authenticating with the Limitless Exchange API.

## Table of Contents

- [Overview](#overview)
- [EOA Authentication](#eoa-authentication)
- [Session Management](#session-management)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Overview

The Limitless Exchange API uses wallet-based authentication:

**EOA (Externally Owned Account)**: Direct wallet authentication using ethers.js with message signing to prove wallet ownership and obtain a session cookie for subsequent requests.

## EOA Authentication

Basic wallet authentication using a private key.

### Quick Start

```typescript
import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator } from '@limitless-exchange/sdk';

// Initialize wallet
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);

// Setup HTTP client
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
});

// Authenticate
const signer = new MessageSigner(wallet);
const authenticator = new Authenticator(httpClient, signer);

const { sessionCookie, profile } = await authenticator.authenticate({
  client: 'eoa',
});

console.log('Authenticated as:', profile.address);
console.log('User ID:', profile.id);
console.log('Fee Rate:', profile.rank?.feeRateBps || 300, 'bps');
```

### What You Get Back

```typescript
interface AuthResponse {
  sessionCookie: string; // Use for authenticated requests
  profile: {
    id: string; // User ID for order creation
    address: string; // Wallet address
    rank?: {
      feeRateBps: number; // Trading fee in basis points (default: 300 = 3%)
    };
  };
}
```

## Session Management

### Using Session Cookies

Once authenticated, include the session cookie in all subsequent requests:

```typescript
// For HTTP requests
const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
  additionalHeaders: {
    cookie: \`limitless_session=\${sessionCookie}\`
  }
});

// For WebSocket connections
const wsClient = new WebSocketClient({
  url: 'wss://ws.limitless.exchange',
  sessionCookie: sessionCookie
});
```

### Session Expiration

Sessions are valid for 24 hours. If your session expires:

```typescript
try {
  await orderClient.createOrder(params);
} catch (error) {
  if (error instanceof ApiError && error.status === 401) {
    // Re-authenticate
    const { sessionCookie } = await authenticator.authenticate({
      client: 'eoa',
    });
    // Update session cookie in your clients
  }
}
```

## Error Handling

### Authentication Retry Pattern

```typescript
import { ApiError } from '@limitless-exchange/sdk';

async function authenticateWithRetry(
  authenticator: Authenticator,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await authenticator.authenticate({
        client: 'eoa'
      });
      console.log('✅ Authenticated successfully');
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(\`Attempt \${attempt}/\${maxRetries} failed:\`, error.message);

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      } else {
        throw error;
      }
    }
  }
}
```

### Common Errors

| Error             | Status | Cause                            | Solution                            |
| ----------------- | ------ | -------------------------------- | ----------------------------------- |
| Invalid signature | 401    | Incorrect private key or signing | Verify private key and wallet setup |
| Network mismatch  | 400    | Wrong chain ID                   | Ensure using Base network (8453)    |
| Rate limited      | 429    | Too many requests                | Implement exponential backoff       |
| Server error      | 500    | API unavailable                  | Retry with backoff                  |

## Best Practices

### 1. Secure Private Key Storage

```typescript
// ❌ BAD - Hardcoded keys
const wallet = new ethers.Wallet('0x1234...');

// ✅ GOOD - Environment variables
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
```

### 2. Validate Configuration

```typescript
if (!process.env.PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable is required');
}

if (process.env.PRIVATE_KEY.length !== 66) {
  throw new Error('Invalid private key format (should start with 0x and be 66 chars)');
}
```

### 3. Cache Session Information

```typescript
interface SessionData {
  sessionCookie: string;
  userId: string;
  feeRateBps: number;
  expiresAt: Date;
}

function saveSession(data: SessionData) {
  // Save to secure storage (not localStorage in production)
  sessionStorage.setItem('limitless_session', JSON.stringify(data));
}

function loadSession(): SessionData | null {
  const data = sessionStorage.getItem('limitless_session');
  if (!data) return null;

  const session = JSON.parse(data);
  if (new Date(session.expiresAt) < new Date()) {
    return null; // Expired
  }

  return session;
}
```

### 4. Handle Multiple Environments

```typescript
const API_URLS = {
  development: 'http://localhost:3000',
  staging: 'https://api-staging.limitless.exchange',
  production: 'https://api.limitless.exchange',
};

const httpClient = new HttpClient({
  baseURL: API_URLS[process.env.NODE_ENV || 'production'],
});
```

## Examples

- [Basic EOA Authentication](../../examples/project-integration/src/basic-auth.ts)
- [Authentication with Retry](../../examples/project-integration/src/auth-retry.ts)

## Next Steps

- [Trading & Orders](../orders/README.md) - Create and manage orders
- [WebSocket](../websocket/README.md) - Real-time data streaming
- [Markets](../markets/README.md) - Market data and orderbooks
