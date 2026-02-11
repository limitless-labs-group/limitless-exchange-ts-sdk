/**
 * Clean Fluent API Example
 *
 * Demonstrates the improved fluent API for working with markets and orders.
 * The Market class now provides a clean, object-oriented interface that eliminates
 * repetitive parameter passing.
 */

// Load environment variables if dotenv is available
try {
  await import('dotenv/config');
} catch {
  // dotenv not available - will use process.env directly
}

import { HttpClient, MarketFetcher } from '../../src';

async function fluentApiExample() {
  console.log('🚀 Clean Fluent API Example\n');

  // Setup HTTP client with API key
  const httpClient = new HttpClient({
    baseURL: process.env.API_URL || 'https://api.limitless.exchange',
    apiKey: process.env.LIMITLESS_API_KEY,
  });

  const marketFetcher = new MarketFetcher(httpClient);

  // 1. Fetch market - returns Market class instance with methods
  console.log('1️⃣ Fetching market...');
  const marketSlug = process.env.MARKET_SLUG || 'bitcoin-2024';
  const market = await marketFetcher.getMarket(marketSlug);

  console.log(`✅ Market: ${market.title}`);
  console.log(`   Type: ${market.marketType}`);
  console.log(`   Slug: ${market.slug}\n`);

  // 2. Get user orders using clean fluent API
  console.log('2️⃣ Fetching user orders with fluent API...');
  const orders = await market.getUserOrders();

  console.log(`✅ Found ${orders.length} orders for this market\n`);
}

// Run the example
fluentApiExample()
  .then(() => {
    console.log('\n✅ Example completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  });
