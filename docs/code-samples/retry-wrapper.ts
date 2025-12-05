/**
 * Working Retry Integration Example using withRetry
 *
 * This demonstrates the retry mechanism that works immediately
 * without decorator compilation issues.
 */

import { HttpClient, withRetry, ConsoleLogger } from '@limitless-exchange/sdk';

/**
 * Market service using withRetry wrapper
 */
class MarketService {
  private httpClient: HttpClient;
  private logger = new ConsoleLogger('debug');

  constructor() {
    this.httpClient = new HttpClient({
      baseURL: 'https://api.limitless.exchange',
      logger: this.logger,
    });
  }

  /**
   * Fetch with retry using withRetry wrapper
   * Demonstrates retry on 404 for demo purposes
   */
  async fetchWithRetry(): Promise<any> {
    return withRetry(
      async () => {
        return await this.httpClient.get('/non-existent-endpoint');
      },
      {
        statusCodes: [404, 429, 500, 503],
        maxRetries: 3,
        delays: [1, 2, 3],
        onRetry: (attempt, error, delay) => {
          console.log(`\n🔄 Retry attempt ${attempt + 1} after ${delay}s delay`);
          console.log(`   Error: ${error.message}`);
        },
      },
      this.logger
    );
  }

  /**
   * With exponential backoff
   */
  async fetchWithExponentialBackoff(): Promise<any> {
    return withRetry(
      async () => {
        return await this.httpClient.get('/another-404');
      },
      {
        statusCodes: [404, 429, 500, 503],
        maxRetries: 4,
        // No delays = exponential backoff
        exponentialBase: 2,
        maxDelay: 30,
      },
      this.logger
    );
  }
}

async function main() {
  console.log('🚀 Retry Wrapper Integration Demo\n');
  console.log('=' .repeat(60));

  const service = new MarketService();

  try {
    console.log('\n📊 Testing retry with non-existent endpoint...');
    console.log('Configuration:');
    console.log('  • Endpoint: /non-existent-endpoint (will return 404)');
    console.log('  • Status codes: [404, 429, 500, 503]');
    console.log('  • Max retries: 3');
    console.log('  • Delays: [1s, 2s, 3s]\n');
    console.log('Making initial request...');

    const result = await service.fetchWithRetry();

    console.log(`\n✅ Unexpected success! Got response:`, result);

  } catch (error: any) {
    console.error(`\n❌ Failed after all retries (expected behavior for this demo)`);
    console.error(`Error type: ${error.constructor.name}`);
    console.error(`Error message: ${error.message}`);
    if (error.status) {
      console.error(`HTTP status: ${error.status}`);
      console.error(`\n💡 The withRetry wrapper successfully attempted 4 total requests:`);
      console.error(`   1 initial request + 3 retry attempts`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Key Benefits:');
  console.log('  • Works immediately without compilation');
  console.log('  • Same retry logic as decorator');
  console.log('  • Configurable delays and max retries');
  console.log('  • Only retries on specified status codes');
  console.log('  • Optional callbacks for monitoring');
  console.log('  • Verbose HTTP logging with ConsoleLogger');
}

// Run the demo
main().catch(console.error);

export { MarketService };
