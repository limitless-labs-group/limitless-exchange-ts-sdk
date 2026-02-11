/**
 * Orderbook Viewing Example
 *
 * This example demonstrates how to:
 * 1. Fetch orderbook data for a market
 * 2. Display raw orderbook response
 */

import { config } from 'dotenv';
import { HttpClient, MarketFetcher, ConsoleLogger } from '@limitless-exchange/sdk';

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL || 'https://api.limitless.exchange';

async function main() {
  console.log('🚀 Orderbook Viewing Example\n');

  // Validate market slug
  const marketSlug = process.env.MARKET_SLUG;
  if (!marketSlug) {
    throw new Error('Please set MARKET_SLUG in .env file');
  }

  // Show configuration
  console.log('⚙️  Configuration:');
  console.log(`   API URL: ${API_URL}`);
  console.log(`   Market: ${marketSlug}\n`);

  const logger = new ConsoleLogger('info');

  try {
    // ===========================================
    // STEP 1: Initialize HTTP Client
    // ===========================================
    console.log('🌐 Step 1: Initializing HTTP client...');

    // Note: No authentication needed - orderbook is a public endpoint
    const httpClient = new HttpClient({
      baseURL: API_URL,
      timeout: 30000,
      logger,
    });

    console.log(`   ✅ HTTP client initialized\n`);

    // ===========================================
    // STEP 2: Fetch Market Orderbook
    // ===========================================
    console.log('📊 Step 2: Fetching orderbook...');

    const marketFetcher = new MarketFetcher(httpClient, logger);
    const orderbook = await marketFetcher.getOrderBook(marketSlug);

    console.log(`   ✅ Orderbook fetched successfully\n`);

    // ===========================================
    // STEP 3: Display Raw Orderbook Data
    // ===========================================
    console.log('📋 Step 3: Orderbook Data:\n');
    console.log(JSON.stringify(orderbook, null, 2));

    console.log('\n🎉 Orderbook example completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('   - Place orders: pnpm run start:gtc-order');
    console.log('   - View positions: pnpm run start:positions');
  } catch (error) {
    console.error('\n❌ Error occurred');

    // Check if it's an APIError with raw response data
    if (error && typeof error === 'object' && 'status' in error && 'data' in error) {
      console.error('   Status:', (error as any).status);
      console.error('   Message:', (error as any).message);
      console.error('   URL:', (error as any).url);
      console.error('   Method:', (error as any).method);
      console.error('   Raw API Response:', JSON.stringify((error as any).data, null, 2));
    } else if (error instanceof Error) {
      console.error('   Message:', error.message);
    } else {
      console.error('   Unknown error:', error);
    }

    // Only show stack trace in debug mode
    if (process.env.DEBUG === 'true' && error instanceof Error && error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the example
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
