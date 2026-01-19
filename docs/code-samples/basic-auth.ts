/**
 * API Key Authentication Example
 *
 * This example demonstrates how to use the SDK with API key authentication.
 * API keys are used for authenticated endpoints like portfolio and orders.
 */

import { config } from 'dotenv';
import { HttpClient, PortfolioFetcher, ConsoleLogger } from '@limitless-exchange/sdk';

// Load environment variables
config();

async function main() {
  console.log('🚀 Limitless Exchange SDK - API Key Authentication Example\n');

  // Validate environment
  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Please set LIMITLESS_API_KEY in .env file\n' +
        'Get your API key from: https://limitless.exchange/settings'
    );
  }

  const apiUrl = process.env.API_URL || 'https://api.limitless.exchange';

  try {
    // Step 1: Initialize HTTP client with API key
    console.log('🌐 Step 1: Initializing HTTP client...');
    const logger = new ConsoleLogger('debug');
    const httpClient = new HttpClient({
      baseURL: apiUrl,
      apiKey, // API key for authenticated requests
      timeout: 30000,
      logger,
    });
    console.log(`   API URL: ${apiUrl}`);
    console.log('   ✅ API key configured\n');

    // Step 2: Test authenticated endpoint (Portfolio)
    console.log('📊 Step 2: Fetching portfolio positions...');
    const portfolio = new PortfolioFetcher(httpClient);
    const positions = await portfolio.getPositions();

    console.log('   ✅ Authentication successful!');
    console.log(`   CLOB positions: ${positions.clob?.length || 0}`);
    console.log(`   AMM positions: ${positions.amm?.length || 0}`);
    console.log(`   Accumulative points: ${positions.accumulativePoints || 0}\n`);

    // Step 3: Fetch transaction history
    console.log('📜 Step 3: Fetching transaction history...');
    const history = await portfolio.getUserHistory(1, 5);
    console.log(`   ✅ Retrieved ${history.data?.length || 0} of ${history.totalCount} entries\n`);

    console.log('🎉 All steps completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('   - Create orders: check trading examples');
    console.log('   - WebSocket streaming: check websocket examples');
  } catch (error) {
    console.error('\n❌ Error occurred');

    // Check if it's an APIError
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as any;
      console.error('   Status:', apiError.status);
      console.error('   Message:', apiError.message);

      if (apiError.status === 401 || apiError.status === 403) {
        console.error('\n   ⚠️  Authentication failed - check your API key');
        console.error('   Get your API key from: https://limitless.exchange');
      }

      if (apiError.url) console.error('   URL:', apiError.url);
      if (apiError.data) {
        console.error('   Raw API Response:', JSON.stringify(apiError.data, null, 2));
      }
    } else if (error instanceof Error) {
      console.error('   Message:', error.message);
    } else {
      console.error('   Unknown error:', error);
    }

    // Show stack trace in debug mode
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
