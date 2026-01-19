/**
 * API Error Handling and Retry Example
 *
 * This example demonstrates how to handle API errors with API key authentication:
 * 1. Handle invalid/expired API keys
 * 2. Implement retry logic for transient failures
 * 3. Long-running script patterns with error recovery
 */

import { config } from 'dotenv';
import {
  HttpClient,
  PortfolioFetcher,
  MarketFetcher,
  ConsoleLogger,
} from '@limitless-exchange/sdk';

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL || 'https://api.limitless.exchange';

/**
 * Example 1: API Key Validation and Error Handling
 */
async function apiKeyValidationExample() {
  console.log('📋 Example 1: API Key Validation\n');

  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    console.log('   ⚠️  No API key found');
    console.log('   💡 Get your API key from: https://limitless.exchange\n');
    return;
  }

  const logger = new ConsoleLogger('info');

  const httpClient = new HttpClient({
    baseURL: API_URL,
    apiKey,
    timeout: 30000,
    logger,
  });

  const portfolioFetcher = new PortfolioFetcher(httpClient);

  try {
    console.log('📊 Testing API key with portfolio fetch...');
    const positions = await portfolioFetcher.getPositions();
    console.log(`   ✅ API key valid - Fetched ${positions.clob?.length || 0} CLOB positions\n`);
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      console.log('   ❌ Invalid or expired API key');
      console.log('   💡 Please regenerate your API key at: https://limitless.exchange\n');
    } else {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log();
}

/**
 * Example 2: Retry Logic for Transient Failures
 */
async function retryLogicExample() {
  console.log('📋 Example 2: Retry Logic for Transient Failures\n');

  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    console.log('   ⚠️  Skipping - LIMITLESS_API_KEY not configured\n');
    return;
  }

  const logger = new ConsoleLogger('info');

  const httpClient = new HttpClient({
    baseURL: API_URL,
    apiKey,
    timeout: 30000,
    logger,
  });

  const marketFetcher = new MarketFetcher(httpClient);

  // Helper function with exponential backoff retry
  async function fetchWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryable = error.status >= 500 || error.code === 'ECONNRESET';

        if (!isRetryable || isLastAttempt) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`   ⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error('Retry logic error');
  }

  try {
    console.log('📊 Fetching markets with retry logic...');
    const markets = await fetchWithRetry(() => marketFetcher.getActiveMarkets({ limit: 5 }));
    console.log(`   ✅ Fetched ${markets.data.length} markets\n`);
  } catch (error: any) {
    console.log(`   ❌ Failed after retries: ${error.message}\n`);
  }

  console.log('='.repeat(60));
  console.log();
}

/**
 * Example 3: Long-Running Script Pattern
 */
async function longRunningExample() {
  console.log('📋 Example 3: Long-Running Script with Error Recovery\n');

  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    console.log('   ⚠️  Skipping - LIMITLESS_API_KEY not configured\n');
    return;
  }

  const logger = new ConsoleLogger('info');

  const httpClient = new HttpClient({
    baseURL: API_URL,
    apiKey,
    timeout: 30000,
    logger,
  });

  const portfolioFetcher = new PortfolioFetcher(httpClient);

  // Simulate long-running process
  console.log('⏱️  Simulating long-running script (checking positions every 10 seconds)...');
  console.log('   Press Ctrl+C to stop\n');

  let iteration = 0;
  const maxIterations = 3; // Just run 3 times for demo
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 3;

  while (iteration < maxIterations) {
    try {
      iteration++;
      console.log(`[Iteration ${iteration}] Fetching portfolio...`);

      const positions = await portfolioFetcher.getPositions();

      console.log(`   CLOB Positions: ${positions.clob?.length || 0}`);
      console.log(`   AMM Positions: ${positions.amm?.length || 0}`);
      console.log(`   Accumulative Points: ${positions.accumulativePoints || 0}`);
      console.log(`   Next check in 10 seconds...\n`);

      // Reset error counter on success
      consecutiveErrors = 0;

      // Wait 10 seconds
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } catch (error: any) {
      consecutiveErrors++;
      console.error(
        `\n   ⚠️  Error ${consecutiveErrors}/${maxConsecutiveErrors}: ${error.message}`
      );

      if (error.status === 401 || error.status === 403) {
        console.error('   ❌ API key invalid - stopping script');
        console.error('   💡 Regenerate key at: https://limitless.exchange\n');
        break;
      }

      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error('   ❌ Too many consecutive errors - stopping script\n');
        break;
      }

      // Exponential backoff before retry
      const delay = 2000 * Math.pow(2, consecutiveErrors - 1);
      console.log(`   ⏳ Waiting ${delay}ms before retry...\n`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.log('✅ Long-running example completed\n');
}

async function main() {
  console.log('🚀 API Error Handling and Retry Examples\n');
  console.log('='.repeat(60));
  console.log();

  try {
    // Run all examples
    await apiKeyValidationExample();
    await retryLogicExample();
    await longRunningExample();

    console.log('\n🎉 All examples completed successfully!\n');
    console.log('📚 Key Takeaways:');
    console.log('   1. API keys are long-lived and do not expire automatically');
    console.log('   2. Handle 401/403 errors by regenerating API key');
    console.log('   3. Implement exponential backoff for transient failures (5xx errors)');
    console.log('   4. Long-running scripts should track consecutive errors');
    console.log('   5. Always provide clear error messages pointing to API key settings\n');
  } catch (error) {
    console.error('\n❌ Error occurred');

    if (error && typeof error === 'object' && 'status' in error && 'data' in error) {
      console.error('   Status:', (error as any).status);
      console.error('   Message:', (error as any).message);
      console.error('   Raw API Response:', JSON.stringify((error as any).data, null, 2));
    } else if (error instanceof Error) {
      console.error('   Message:', error.message);
    } else {
      console.error('   Unknown error:', error);
    }

    if (process.env.DEBUG === 'true' && error instanceof Error && error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the examples
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
