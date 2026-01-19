/**
 * Portfolio Positions Example
 *
 * This example demonstrates how to:
 * 1. Authenticate with API key
 * 2. Fetch user positions (CLOB and AMM)
 * 3. Display raw position data
 */

import { config } from 'dotenv';
import { HttpClient, PortfolioFetcher, ConsoleLogger } from '@limitless-exchange/sdk';

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL || 'https://api.limitless.exchange';

async function main() {
  console.log('🚀 Portfolio Positions Example\n');

  // Validate API key
  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Please set LIMITLESS_API_KEY in .env file\n' +
        'Get your API key from: https://limitless.exchange/settings/api-keys'
    );
  }

  // Show configuration
  console.log('⚙️  Configuration:');
  console.log(`   API URL: ${API_URL}\n`);

  const logger = new ConsoleLogger('info');

  try {
    // ===========================================
    // STEP 1: Initialize HTTP Client with API Key
    // ===========================================
    console.log('🔐 Step 1: Initializing HTTP client...');

    const httpClient = new HttpClient({
      baseURL: API_URL,
      apiKey,
      timeout: 30000,
      logger,
    });

    console.log(`   ✅ HTTP client initialized\n`);

    // ===========================================
    // STEP 2: Fetch Portfolio Positions
    // ===========================================
    console.log('📊 Step 2: Fetching portfolio positions...');

    const portfolioFetcher = new PortfolioFetcher(httpClient, logger);
    const response = await portfolioFetcher.getPositions();

    console.log(`   ✅ Portfolio fetched successfully\n`);

    // ===========================================
    // STEP 3: Display Raw Position Data
    // ===========================================
    console.log('📋 Step 3: Portfolio Position Data:\n');
    console.log(JSON.stringify(response, null, 2));

    console.log('\n🎉 Portfolio positions example completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('   - Place orders: pnpm run start:gtc-order');
    console.log('   - View orderbook: pnpm run start:orderbook');
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
