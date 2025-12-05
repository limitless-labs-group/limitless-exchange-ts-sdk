/**
 * Example: Fetching Active Markets
 *
 * This example demonstrates how to fetch active markets from the Limitless Exchange
 * with various sorting options and pagination.
 *
 * NOTE: This is a PUBLIC endpoint - no authentication required!
 */

import { HttpClient, MarketFetcher } from "@limitless/exchange-ts-sdk";

async function main() {
  // Create HTTP client (no authentication needed for public market data)
  const httpClient = new HttpClient({
    baseURL: "https://api.limitless.exchange",
  });

  // Create market fetcher
  const marketFetcher = new MarketFetcher(httpClient);

  console.log("=== Fetching Active Markets Examples ===\n");

  // Example 1: Get active markets sorted by LP rewards
  console.log("1. Markets with highest LP rewards:");
  const lpRewardsMarkets = await marketFetcher.getActiveMarkets({
    limit: 8,
    sortBy: "lp_rewards",
  });
  console.log(`   Found ${lpRewardsMarkets.data.length} of ${lpRewardsMarkets.totalMarketsCount} markets\n`);

  // Display first few markets
  lpRewardsMarkets.data.slice(0, 3).forEach((market, index) => {
    console.log(`   ${index + 1}. ${market.title}`);
    console.log(`      Slug: ${market.slug}`);
    console.log(`      Type: ${market.type || "N/A"}`);
  });
  console.log("");

  // Example 2: Get markets ending soon
  console.log("2. Markets ending soon:");
  const endingSoonMarkets = await marketFetcher.getActiveMarkets({
    limit: 8,
    sortBy: "ending_soon",
  });
  console.log(`   Found ${endingSoonMarkets.data.length} markets`);
  endingSoonMarkets.data.slice(0, 3).forEach((market, index) => {
    console.log(`   ${index + 1}. ${market.title}`);
    if (market.resolutionDate) {
      console.log(`      Resolves: ${new Date(market.resolutionDate).toLocaleDateString()}`);
    }
  });
  console.log("");

  // Example 3: Get newest markets
  console.log("3. Newest markets:");
  const newestMarkets = await marketFetcher.getActiveMarkets({
    limit: 8,
    sortBy: "newest",
  });
  console.log(`   Found ${newestMarkets.data.length} markets`);
  newestMarkets.data.slice(0, 3).forEach((market, index) => {
    console.log(`   ${index + 1}. ${market.title}`);
    console.log(`      Created: ${new Date(market.createdAt).toLocaleDateString()}`);
  });
  console.log("");

  // Example 4: Pagination - get page 2 of markets
  console.log("4. Pagination example (page 2 of LP rewards):");
  const page2Markets = await marketFetcher.getActiveMarkets({
    limit: 8,
    page: 2,
    sortBy: "lp_rewards",
  });
  console.log(`   Showing ${page2Markets.data.length} markets from page 2`);
  console.log(`   Total markets: ${page2Markets.totalMarketsCount}\n`);

  // Example 5: Get markets by high value
  console.log("5. Markets sorted by high value:");
  const volumeMarkets = await marketFetcher.getActiveMarkets({
    limit: 5,
    sortBy: "high_value",
  });
  console.log(`   Found ${volumeMarkets.data.length} markets\n`);

  // Example 7: Paginate through all active markets
  console.log("7. Paginating through all markets:");
  let currentPage = 1;
  const pageSize = 10;
  let totalFetched = 0;

  while (true) {
    const page = await marketFetcher.getActiveMarkets({
      limit: pageSize,
      page: currentPage,
      sortBy: "newest",
    });

    totalFetched += page.data.length;
    console.log(`   Fetched page ${currentPage} with ${page.data.length} markets`);

    // Check if we've fetched all markets
    if (page.data.length < pageSize || totalFetched >= page.totalMarketsCount) {
      console.log(`   Reached end. Total markets fetched: ${totalFetched}\n`);
      break;
    }

    currentPage++;

    // Safety limit for example (remove in production)
    if (currentPage > 3) {
      console.log(`   Stopping at page ${currentPage} for example purposes\n`);
      break;
    }
  }

  // Example 8: Get all markets without pagination (default behavior)
  console.log("8. Fetching active markets with default parameters:");
  const defaultMarkets = await marketFetcher.getActiveMarkets();
  console.log(`   Found ${defaultMarkets.data.length} of ${defaultMarkets.totalMarketsCount} markets\n`);
}

// Run the example
main()
  .then(() => {
    console.log("✅ Example completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    process.exit(1);
  });
