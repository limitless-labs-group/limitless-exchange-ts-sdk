/**
 * HTTP Client with Debug Logging
 *
 * This example demonstrates how to enable debug logging
 * to help troubleshoot integration issues.
 */

import { config } from 'dotenv';
import { HttpClient, PortfolioFetcher, ConsoleLogger } from '@limitless-exchange/sdk';

config();

async function main() {
  console.log('🚀 Limitless Exchange SDK - Debug Logging Example\n');

  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Please set LIMITLESS_API_KEY in .env file\n' +
        'Get your API key from: https://limitless.exchange'
    );
  }

  const apiUrl = process.env.API_URL || 'https://api.limitless.exchange';

  try {
    // IMPORTANT: Create a logger for debugging
    // Use 'debug' level to see all SDK operations
    // Use 'info' level to see only important events
    // Use 'error' level to see only errors
    const logger = new ConsoleLogger('debug');

    console.log('--- SDK Logs (debug level) ---\n');

    // Initialize HTTP client WITH logger
    const httpClient = new HttpClient({
      baseURL: apiUrl,
      apiKey,
      timeout: 30000,
      logger, // ← Logger attached here
    });

    console.log('🌐 HTTP client initialized with debug logging\n');

    // Make a request - you'll see detailed logs from the SDK
    const portfolio = new PortfolioFetcher(httpClient);
    const positions = await portfolio.getPositions();

    console.log('\n--- End SDK Logs ---\n');

    console.log('✅ Request successful!');
    console.log(`CLOB positions: ${positions.clob?.length || 0}`);
    console.log(`AMM positions: ${positions.amm?.length || 0}`);
    console.log(`Accumulative points: ${positions.accumulativePoints || 0}\n`);

    // Another request - more SDK logs
    console.log('--- SDK Logs (fetching history) ---\n');
    const history = await portfolio.getUserHistory(1, 5);
    console.log('\n--- End SDK Logs ---\n');

    console.log(`✅ Retrieved ${history.data?.length || 0} transaction(s)\n`);

    console.log('💡 Logging tips:');
    console.log('   - Use "debug" level during development');
    console.log('   - Use "info" level in production');
    console.log('   - Use "error" level for minimal output');
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

main().catch(console.error);
