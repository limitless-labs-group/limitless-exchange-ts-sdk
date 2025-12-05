/**
 * Authentication Retry Example
 *
 * This example demonstrates how to handle authentication token expiration:
 * 1. Manual retry pattern (recommended for most use cases)
 * 2. Optional AuthenticatedClient helper for automatic retry
 */

import { config } from "dotenv";
import { ethers } from "ethers";
import {
  HttpClient,
  MessageSigner,
  Authenticator,
  PortfolioFetcher,
  AuthenticatedClient,
  APIError,
  ConsoleLogger,
} from "@limitless/exchange-ts-sdk";

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL || "https://api.limitless.exchange";

/**
 * Example 1: Manual Retry Pattern (Recommended)
 *
 * This gives you full control over retry logic and is suitable for most applications.
 */
async function manualRetryExample() {
  console.log("📋 Example 1: Manual Retry Pattern\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("Please set PRIVATE_KEY in .env file");
  }

  const logger = new ConsoleLogger("info");
  const wallet = new ethers.Wallet(privateKey);

  const httpClient = new HttpClient({
    baseURL: API_URL,
    timeout: 30000,
  });

  const signer = new MessageSigner(wallet);
  const authenticator = new Authenticator(httpClient, signer, logger);

  // Initial authentication
  console.log("🔐 Authenticating...");
  await authenticator.authenticate({ client: "eoa" });
  console.log("   ✅ Authenticated\n");

  const portfolioFetcher = new PortfolioFetcher(httpClient, logger);

  // Manual retry function
  async function fetchWithRetry() {
    try {
      console.log("📊 Fetching portfolio positions...");
      const positions = await portfolioFetcher.getPositions();
      console.log(`   ✅ Fetched ${positions.clob.length} CLOB positions\n`);
      return positions;
    } catch (error) {
      // Check if it's an auth error
      if (error instanceof APIError && error.isAuthError()) {
        console.log("   ⚠️  Authentication expired (401/403)");
        console.log("   🔄 Re-authenticating...");

        // Re-authenticate
        await authenticator.authenticate({ client: "eoa" });
        console.log("   ✅ Re-authenticated");

        // Retry the request
        console.log("   🔄 Retrying request...");
        const positions = await portfolioFetcher.getPositions();
        console.log(`   ✅ Fetched ${positions.clob.length} CLOB positions\n`);
        return positions;
      }

      // Not an auth error, rethrow
      throw error;
    }
  }

  await fetchWithRetry();

  console.log("✅ Manual retry example completed\n");
  console.log("=" .repeat(60));
  console.log();
}

/**
 * Example 2: AuthenticatedClient Helper (Optional)
 *
 * Automatic retry wrapper for convenience. Use this if you want
 * automatic re-authentication without writing retry logic.
 */
async function autoRetryExample() {
  console.log("📋 Example 2: AuthenticatedClient Helper (Optional)\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("Please set PRIVATE_KEY in .env file");
  }

  const logger = new ConsoleLogger("info");
  const wallet = new ethers.Wallet(privateKey);

  const httpClient = new HttpClient({
    baseURL: API_URL,
    timeout: 30000,
  });

  const signer = new MessageSigner(wallet);
  const authenticator = new Authenticator(httpClient, signer, logger);

  // Initial authentication
  console.log("🔐 Authenticating...");
  await authenticator.authenticate({ client: "eoa" });
  console.log("   ✅ Authenticated\n");

  // Create authenticated client with auto-retry
  const authClient = new AuthenticatedClient({
    httpClient,
    authenticator,
    client: "eoa",
    logger,
    maxRetries: 1, // Retry once on auth failure
  });

  const portfolioFetcher = new PortfolioFetcher(httpClient, logger);

  // Use withRetry for automatic re-authentication
  console.log("📊 Fetching portfolio positions with auto-retry...");
  const positions = await authClient.withRetry(() =>
    portfolioFetcher.getPositions()
  );
  console.log(`   ✅ Fetched ${positions.clob.length} CLOB positions\n`);

  console.log("✅ Auto-retry example completed\n");
  console.log("=" .repeat(60));
  console.log();
}

/**
 * Example 3: Long-Running Script Pattern
 *
 * For scripts that run for extended periods (days/weeks),
 * wrap all API calls with retry logic.
 */
async function longRunningExample() {
  console.log("📋 Example 3: Long-Running Script Pattern\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("Please set PRIVATE_KEY in .env file");
  }

  const logger = new ConsoleLogger("info");
  const wallet = new ethers.Wallet(privateKey);

  const httpClient = new HttpClient({
    baseURL: API_URL,
    timeout: 30000,
  });

  const signer = new MessageSigner(wallet);
  const authenticator = new Authenticator(httpClient, signer, logger);

  // Initial authentication
  console.log("🔐 Authenticating...");
  await authenticator.authenticate({ client: "eoa" });
  console.log("   ✅ Authenticated\n");

  const authClient = new AuthenticatedClient({
    httpClient,
    authenticator,
    client: "eoa",
    logger,
  });

  const portfolioFetcher = new PortfolioFetcher(httpClient, logger);

  // Simulate long-running process
  console.log("⏱️  Simulating long-running script (checking positions every 10 seconds)...");
  console.log("   Press Ctrl+C to stop\n");

  let iteration = 0;
  const maxIterations = 3; // Just run 3 times for demo

  while (iteration < maxIterations) {
    try {
      iteration++;
      console.log(`[Iteration ${iteration}] Fetching positions...`);

      // All API calls wrapped with retry
      const { summary } = await authClient.withRetry(() =>
        portfolioFetcher.getPortfolio()
      );

      console.log(`   Total Value: $${(summary.totalValue / 1e6).toFixed(2)}`);
      console.log(`   Positions: ${summary.positionCount}`);
      console.log(`   Next check in 10 seconds...\n`);

      // Wait 10 seconds
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error) {
      console.error("\n❌ Error occurred");

      if (error instanceof APIError) {
        console.error("   Status:", error.status);
        console.error("   Message:", error.message);
      } else if (error instanceof Error) {
        console.error("   Message:", error.message);
      }

      // In production, you might want to continue or implement backoff
      break;
    }
  }

  console.log("✅ Long-running example completed\n");
}

async function main() {
  console.log("🚀 Authentication Retry Examples\n");
  console.log("=" .repeat(60));
  console.log();

  try {
    // Run all examples
    await manualRetryExample();
    await autoRetryExample();
    await longRunningExample();

    console.log("\n🎉 All examples completed successfully!\n");
    console.log("📚 Key Takeaways:");
    console.log("   1. Session tokens expire after ~1 month");
    console.log("   2. Use APIError.isAuthError() to detect 401/403 errors");
    console.log("   3. Manual retry gives you full control (recommended)");
    console.log("   4. AuthenticatedClient provides automatic retry (optional)");
    console.log("   5. Long-running scripts should wrap all API calls with retry\n");

  } catch (error) {
    console.error("\n❌ Error occurred");

    if (error && typeof error === 'object' && 'status' in error && 'data' in error) {
      console.error("   Status:", (error as any).status);
      console.error("   Message:", (error as any).message);
      console.error("   Raw API Response:", JSON.stringify((error as any).data, null, 2));
    } else if (error instanceof Error) {
      console.error("   Message:", error.message);
    } else {
      console.error("   Unknown error:", error);
    }

    if (process.env.DEBUG === 'true' && error instanceof Error && error.stack) {
      console.error("\n   Stack trace:");
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the examples
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
