# Market Pages & Navigation

Guide to the navigation-based market discovery API.

## Overview

The market-pages API is the newer, flexible alternative to legacy category-only market discovery.

It provides:
- Navigation tree (`/navigation`)
- Path resolution with redirects (`/market-pages/by-path`)
- Page-scoped market listing with dynamic filters (`/market-pages/:id/markets`)
- Global property key discovery (`/property-keys`)

These endpoints are public and do not require authentication.

## Basic Usage

```typescript
import { HttpClient, MarketPageFetcher } from '@limitless-exchange/sdk';

const httpClient = new HttpClient({
  baseURL: 'https://api.limitless.exchange',
});

const pageFetcher = new MarketPageFetcher(httpClient);

// 1) Navigation tree
const nav = await pageFetcher.getNavigation();

// 2) Resolve page by path
const cryptoPage = await pageFetcher.getMarketPageByPath('/crypto');

// 3) List markets for the page with filters
const markets = await pageFetcher.getMarkets(cryptoPage.id, {
  limit: 20,
  sort: '-updatedAt',
  filters: {
    duration: 'hourly',
    ticker: ['btc', 'eth'],
  },
});

if ('pagination' in markets) {
  console.log(markets.pagination.total);
}
```

## Redirect Handling

`getMarketPageByPath()` handles 301 redirects from the backend internally.

Example flow:
- request: `path=/old-path`
- backend: `301 Location: /new-path`
- SDK automatically retries with `/new-path`

## Pagination Modes

### Offset pagination

```typescript
const response = await pageFetcher.getMarkets(pageId, {
  page: 1,
  limit: 20,
});

if ('pagination' in response) {
  console.log(response.pagination.page);
}
```

### Cursor pagination

```typescript
const first = await pageFetcher.getMarkets(pageId, { cursor: '', limit: 20 });

if ('cursor' in first && first.cursor.nextCursor) {
  const second = await pageFetcher.getMarkets(pageId, {
    cursor: first.cursor.nextCursor,
    limit: 20,
  });
}
```

## Property Keys

```typescript
// List all property keys
const keys = await pageFetcher.getPropertyKeys();

// Get single key
const key = await pageFetcher.getPropertyKey(keys[0].id);

// List root options for key
const rootOptions = await pageFetcher.getPropertyOptions(key.id);

// List child options for one parent
const childOptions = await pageFetcher.getPropertyOptions(key.id, rootOptions[0]?.id);
```
