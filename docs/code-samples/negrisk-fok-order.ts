/**
 * NegRisk FOK (Fill-or-Kill) Order Example
 *
 * This example demonstrates how to:
 * 1. Initialize SDK with API key authentication
 * 2. Fetch a NegRisk group market and select a submarket
 * 3. Create FOK market orders on NegRisk submarkets
 * 4. Execute immediate BUY and SELL orders at best available price
 *
 * FOK orders are market orders - you specify makerAmount (USDC to spend for BUY, shares to sell for SELL),
 * and the order fills at the best available price or cancels if not fully matched.
 *
 * KEY DIFFERENCE: Use the SUBMARKET slug, not the group slug!
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import {
  HttpClient,
  OrderClient,
  MarketFetcher,
  Side,
  OrderType,
  ConsoleLogger,
  getContractAddress,
} from '@limitless-exchange/sdk';

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL || 'https://api.limitless.exchange';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '8453'); // Base mainnet

const MARKET_SLUG_FALLBACK = 'largest-company-end-of-2025-1746118069282';

async function main() {
  console.log('🚀 NegRisk FOK (Fill-or-Kill) Order Example\n');

  // Validate API key
  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Please set LIMITLESS_API_KEY in .env file\n' +
        'Get your API key from: https://limitless.exchange'
    );
  }

  // Get market slug from env or use default
  const NEGRISK_GROUP_SLUG = process.env.MARKET_SLUG || MARKET_SLUG_FALLBACK;
  console.log(`Using NegRisk Group Market: ${NEGRISK_GROUP_SLUG}\n`);

  // Validate private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Please set PRIVATE_KEY in .env file');
  }

  // Show configuration
  console.log('⚙️  Configuration:');
  console.log(`   API URL: ${API_URL}`);
  console.log(`   Chain ID: ${CHAIN_ID}`);

  const logger = new ConsoleLogger('info');

  try {
    // ===========================================
    // STEP 1: Initialize HTTP Client and Wallet
    // ===========================================
    console.log('🔐 Step 1: Initializing HTTP client and wallet...');

    const httpClient = new HttpClient({
      baseURL: API_URL,
      apiKey,
      timeout: 30000,
      logger,
    });

    const wallet = new ethers.Wallet(privateKey);

    console.log(`   ✅ HTTP client initialized`);
    console.log(`   ✅ Wallet initialized: ${wallet.address}\n`);

    // ===========================================
    // STEP 2: Fetch NegRisk Group Market
    // ===========================================
    console.log('📊 Step 2: Fetching NegRisk Group Market...');

    const marketFetcher = new MarketFetcher(httpClient);
    const groupMarketResponse = await marketFetcher.getMarket(NEGRISK_GROUP_SLUG);

    // Cast to any to access properties not in the Market type definition
    const groupMarket = groupMarketResponse as any;

    console.log('📦 Group Market Details:');
    console.log('   Title:', groupMarket.title);
    console.log('   Type:', groupMarket.marketType); // "group" for NegRisk
    console.log('   Number of Submarkets:', groupMarket.markets?.length || 0, '\n');

    if (!groupMarket.markets || groupMarket.markets.length === 0) {
      console.log('   ⚠️  No submarkets found in this group');
      return;
    }

    // Display available submarkets
    console.log('📋 Available Submarkets:');
    groupMarket.markets.forEach((submarket: any, index: number) => {
      console.log(`   ${index + 1}. ${submarket.title} (${submarket.slug})`);
      console.log(`      Prices: Yes=${submarket.prices?.[0]} | No=${submarket.prices?.[1]}`);
    });

    // Pick first submarket as example
    const exampleSubmarket = groupMarket.markets[0] as any;
    console.log(`\n   Selected: ${exampleSubmarket.title} (${exampleSubmarket.slug})\n`);

    // Get detailed info for token IDs
    const detailedInfoResponse = await marketFetcher.getMarket(exampleSubmarket.slug);
    const detailedInfo = detailedInfoResponse as any;

    console.log('   Token IDs:');
    console.log(`      YES: ${detailedInfo.tokens?.yes}`);
    console.log(`      NO: ${detailedInfo.tokens?.no}\n`);

    // ===========================================
    // STEP 3: Create Order Client for NegRisk
    // ===========================================
    console.log('🔨 Step 3: Creating NegRisk order client...');

    const orderClient = new OrderClient({
      httpClient,
      wallet,
    });

    console.log('   ✅ Order client ready');
    console.log('   User data will be fetched automatically on first order\n');

    // ===========================================
    // STEP 4: Place FOK BUY Order
    // ===========================================
    console.log('📤 Step 4: Placing FOK BUY Order on NegRisk Submarket...');

    const buyOrderParams = {
      tokenId: detailedInfo.tokens.yes, // YES token ID
      makerAmount: 2.05, // 1 USDC to spend (human-readable)
      side: Side.BUY,
    };

    console.log('\n📋 BUY Order Configuration:');
    console.log(`   Market: ${exampleSubmarket.title}`);
    console.log(`   Submarket Slug: ${exampleSubmarket.slug}`);
    console.log(`   Token ID: ${buyOrderParams.tokenId}`);
    console.log(`   Side: BUY`);
    console.log(`   Amount: ${buyOrderParams.makerAmount} USDC`);
    console.log(`   Type: FOK (market order - executes immediately at best price)\n`);

    console.log('📤 Creating and submitting FOK BUY order...');

    // IMPORTANT: Use the SUBMARKET slug, not the group slug!
    const buyOrderResponse = await orderClient.createOrder({
      ...buyOrderParams,
      orderType: OrderType.FOK,
      marketSlug: exampleSubmarket.slug, // ← Use submarket slug!
    });

    console.log('   ✅ Order submitted successfully!');
    console.log(`   Order ID: ${buyOrderResponse.order.id}`);
    console.log(`   Created at: ${buyOrderResponse.order.createdAt}`);
    console.log(`   Market ID: ${buyOrderResponse.order.marketId}`);

    // Print full response for inspection
    console.log('\n📋 Full BUY Order Response:');
    console.log(JSON.stringify(buyOrderResponse, null, 2));

    // Check matches - FOK orders are ALWAYS matched or cancelled
    if (buyOrderResponse.makerMatches && buyOrderResponse.makerMatches.length > 0) {
      console.log(`\n   🎯 Order was MATCHED!`);
      console.log(`   Total matches: ${buyOrderResponse.makerMatches.length}`);

      buyOrderResponse.makerMatches.forEach((match, index) => {
        console.log(`\n   Match ${index + 1}:`);
        console.log(`     Match ID: ${match.id}`);
        console.log(`     Matched Size: ${match.matchedSize}`);
        console.log(`     Order ID: ${match.orderId}`);
        console.log(`     Matched at: ${match.createdAt}`);
      });
    } else {
      console.log(`\n   ❌ Order was CANCELLED (not enough liquidity)`);
      console.log(`   FOK orders must be fully matched or they are cancelled`);
    }

    // ===========================================
    // STEP 5: Place FOK SELL Order
    // ===========================================
    console.log('\n\n' + '='.repeat(60));
    console.log('📤 STEP 5: Placing FOK SELL Order on NegRisk Submarket');
    console.log('='.repeat(60));

    const sellOrderParams = {
      tokenId: detailedInfo.tokens.yes, // YES token ID
      makerAmount: 0.5, // 0.5 shares to sell
      side: Side.SELL,
    };

    console.log('\n📋 SELL Order Configuration:');
    console.log(`   Market: ${exampleSubmarket.title}`);
    console.log(`   Submarket Slug: ${exampleSubmarket.slug}`);
    console.log(`   Token ID: ${sellOrderParams.tokenId}`);
    console.log(`   Side: SELL`);
    console.log(`   Maker Amount: ${sellOrderParams.makerAmount} shares`);
    console.log(`   Type: FOK (market order - executes immediately at best price)\n`);

    console.log('📤 Creating and submitting FOK SELL order...');

    const sellOrderResponse = await orderClient.createOrder({
      ...sellOrderParams,
      orderType: OrderType.FOK,
      marketSlug: exampleSubmarket.slug, // ← Use submarket slug!
    });

    console.log('   ✅ Order submitted successfully!');
    console.log(`   Order ID: ${sellOrderResponse.order.id}`);
    console.log(`   Created at: ${sellOrderResponse.order.createdAt}`);
    console.log(`   Market ID: ${sellOrderResponse.order.marketId}`);

    // Print full SELL order response
    console.log('\n📋 Full SELL Order Response:');
    console.log(JSON.stringify(sellOrderResponse, null, 2));

    // Check matches
    if (sellOrderResponse.makerMatches && sellOrderResponse.makerMatches.length > 0) {
      console.log(`\n   🎯 SELL Order was MATCHED!`);
      console.log(`   Total matches: ${sellOrderResponse.makerMatches.length}`);

      let totalShares = 0;
      let totalRevenue = 0;

      sellOrderResponse.makerMatches.forEach((match, index) => {
        console.log(`\n   Match ${index + 1}:`);
        console.log(`     Match ID: ${match.id}`);
        console.log(`     Matched Size: ${match.matchedSize}`);
        console.log(`     Order ID: ${match.orderId}`);
        console.log(`     Matched at: ${match.createdAt}`);
      });
    } else {
      console.log(`\n   ❌ SELL Order was CANCELLED (not enough liquidity)`);
      console.log(`   FOK orders must be fully matched or they are cancelled`);
    }

    // ===========================================
    // STEP 6: Summary
    // ===========================================
    console.log('\n\n📚 Key Points About NegRisk FOK Orders');
    console.log('='.repeat(60));

    console.log('\n1️⃣  Market Selection:');
    console.log("   - Use SUBMARKET slug for orders (e.g., 'apple-1746118069293')");
    console.log("   - NOT group slug (e.g., 'largest-company-end-of-2025-1746118069282')");

    console.log('\n2️⃣  FOK Order Behavior:');
    console.log('   - FOK = Fill-or-Kill (market order)');
    console.log('   - Specify amount in USDC (human-readable, max 2 decimals)');
    console.log('   - Order executes immediately at best price or cancels');
    console.log('   - No partial fills - must be fully matched');

    console.log('\n4️⃣  Token IDs:');
    console.log('   - Each submarket has unique YES/NO token IDs');
    console.log('   - Get from: await marketFetcher.getMarket(submarketSlug)');

    console.log('\n\n✅ NegRisk FOK order example completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   - Try GTC orders: pnpm run start:negrisk-trading');
    console.log('   - Explore other submarkets in the group');
    console.log('   - Adjust order amounts based on available liquidity');
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
