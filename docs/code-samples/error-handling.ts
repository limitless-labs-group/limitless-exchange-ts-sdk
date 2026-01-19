/**
 * Error Handling Example
 *
 * This example demonstrates proper error handling patterns
 * when using the Limitless Exchange SDK with API key authentication.
 */

import { config } from 'dotenv';
import { HttpClient, MarketFetcher } from '@limitless-exchange/sdk';

config();

async function main() {
  console.log('🚀 Limitless Exchange SDK - Error Handling Patterns\n');

  // Example 1: Missing API key
  console.log('📝 Example 1: Handling missing API key...');
  try {
    const httpClient = new HttpClient({
      baseURL: 'https://api.limitless.exchange',
      apiKey: '', // Empty API key
      timeout: 30000,
    });
    const marketFetcher = new MarketFetcher(httpClient);
    await marketFetcher.getActiveMarkets();
    console.log('   ❌ Should have thrown an error');
  } catch (error) {
    console.log('   ✅ Caught error:', error instanceof Error ? error.message : error);
  }
  console.log();

  // Example 2: Network timeout
  console.log('📝 Example 2: Network timeout handling...');
  try {
    const httpClient = new HttpClient({
      baseURL: 'https://invalid-api-url-that-does-not-exist.com',
      apiKey: 'test-key',
      timeout: 1000, // 1 second timeout
    });
    const marketFetcher = new MarketFetcher(httpClient);
    await marketFetcher.getActiveMarkets();
    console.log('   ❌ Should have thrown an error');
  } catch (error) {
    console.log('   ✅ Caught network error:', error instanceof Error ? error.message : error);
  }
  console.log();

  // Example 3: Proper error handling pattern with API key
  console.log('📝 Example 3: Recommended error handling pattern...');

  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    console.log('   ⚠️  Skipping - LIMITLESS_API_KEY not configured\n');
    console.log('   💡 Get your API key from: https://limitless.exchange');
    return;
  }

  try {
    const httpClient = new HttpClient({
      baseURL: process.env.API_URL || 'https://api.limitless.exchange',
      apiKey,
      timeout: 30000,
    });

    const marketFetcher = new MarketFetcher(httpClient);
    const markets = await marketFetcher.getActiveMarkets({ limit: 1 });

    console.log('   ✅ API request successful');
    console.log(`   Retrieved ${markets.data.length} market(s)\n`);
  } catch (error) {
    // Detailed error handling
    if (error instanceof Error) {
      console.log('   ❌ Error type:', error.constructor.name);
      console.log('   ❌ Message:', error.message);

      // Handle specific error patterns
      if (error.message.includes('API Error') || error.message.includes('401')) {
        console.log('   💡 Suggestion: Check your API key is valid');
        console.log('   💡 Get a new key at: https://limitless.exchange');
      } else if (error.message.includes('timeout')) {
        console.log('   💡 Suggestion: Increase timeout or check network');
      } else if (error.message.includes('network')) {
        console.log('   💡 Suggestion: Check API endpoint and network connection');
      }
    }
  }
  console.log();

  console.log('🎉 Error handling examples completed!');
  console.log('\n💡 Best Practices:');
  console.log('   1. Always use try-catch blocks for async operations');
  console.log('   2. Check error types and messages for specific handling');
  console.log('   3. Validate API key before SDK calls');
  console.log('   4. Set appropriate timeouts for network operations');
  console.log('   5. Handle authentication errors gracefully');
  console.log('   6. Provide clear error messages to users');
}

main().catch(console.error);
