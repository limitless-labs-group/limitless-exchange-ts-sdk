/**
 * Real Integration Example: @retryOnErrors Decorator
 *
 * This example demonstrates the @retryOnErrors decorator approach.
 * Run with: pnpm start:retry-decorator (compiles first, then runs)
 */

import { HttpClient, retryOnErrors, ConsoleLogger } from "@limitless-exchange/sdk";

/**
 * Market service with retry-enabled methods using decorators
 */
class MarketService {
  private httpClient: HttpClient;
  private logger = new ConsoleLogger("debug"); // Use debug level for verbose logging

  constructor() {
    this.httpClient = new HttpClient({
      baseURL: "https://api.limitless.exchange",
      logger: this.logger, // Pass logger to HTTP client
    });
  }

  /**
   * Fetch markets with automatic retry on transient failures.
   *
   * This will automatically retry if the API returns:
   * - 404 (Not Found - for demo purposes, simulates API endpoint not available)
   * - 429 (Rate Limit)
   * - 500 (Internal Server Error)
   * - 503 (Service Unavailable)
   */
  @retryOnErrors({
    statusCodes: [404, 429, 500, 503],
    maxRetries: 3,
    delays: [1, 2, 3], // Wait 1s, then 2s, then 3s between retries (faster for demo)
    onRetry: (attempt, error, delay) => {
      console.log(`\n🔄 Retry attempt ${attempt + 1} scheduled`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Waiting ${delay}s before retry...`);
    },
  })
  async fetchMarketsWithRetry(): Promise<any> {
    // Using a non-existent endpoint to demonstrate retry behavior
    return await this.httpClient.get("/non-existent-endpoint");
  }

  /**
   * Example with fewer retries
   */
  @retryOnErrors({
    statusCodes: [404, 429, 500, 503],
    maxRetries: 2,
    delays: [1, 3],
  })
  async fetchWithShortRetry(): Promise<any> {
    return await this.httpClient.get("/another-404-endpoint");
  }

  /**
   * Example with exponential backoff (no fixed delays)
   */
  @retryOnErrors({
    statusCodes: [404, 429, 500, 503],
    maxRetries: 4,
    // No delays = exponential backoff: 1s, 2s, 4s, 8s
    exponentialBase: 2,
    maxDelay: 30, // Cap at 30 seconds
  })
  async fetchWithExponentialBackoff(): Promise<any> {
    return await this.httpClient.get("/yet-another-404");
  }
}

/**
 * Usage example
 */
async function main() {
  console.log("🚀 Retry Mechanism Real Integration Example\n");
  console.log("=".repeat(60));

  const service = new MarketService();

  try {
    console.log("\n📊 Testing retry mechanism with non-existent endpoint...");
    console.log("Configuration:");
    console.log("  • Endpoint: /non-existent-endpoint (will return 404)");
    console.log("  • Status codes: [404, 429, 500, 503]");
    console.log("  • Max retries: 3");
    console.log("  • Delays: [1s, 2s, 3s]\n");
    console.log("Making initial request...");

    const result = await service.fetchMarketsWithRetry();

    console.log(`\n✅ Unexpected success! Got response:`, result);
  } catch (error: any) {
    console.error(`\n❌ Failed after all retries (expected behavior for this demo)`);
    console.error(`Error type: ${error.constructor.name}`);
    console.error(`Error message: ${error.message}`);
    if (error.status) {
      console.error(`HTTP status: ${error.status}`);
      console.error(`\n💡 The retry decorator successfully attempted 4 total requests:`);
      console.error(`   1 initial request + 3 retry attempts`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✨ Key Benefits:");
  console.log("  • Transparent retry - no changes to call site");
  console.log("  • Configurable delays and max retries");
  console.log("  • Only retries on specified status codes");
  console.log("  • Optional callbacks for monitoring");
  console.log("  • Works with any async method");
}

main().catch(console.error);

export { MarketService };
