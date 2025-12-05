/**
 * NegRisk Group Market Trading Example
 *
 * This example demonstrates how to interact with NegRisk group markets:
 * 1. Fetch a NegRisk group market (multiple related outcomes)
 * 2. Browse individual submarkets within the group
 * 3. Get orderbook for specific submarkets
 * 4. Place orders on NegRisk submarkets
 *
 * NegRisk markets are "group" markets where multiple related outcomes
 * are traded together (e.g., "Largest Company 2025" with Apple, Microsoft, NVIDIA, etc.)
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import {
  HttpClient,
  MessageSigner,
  Authenticator,
  OrderClient,
  MarketFetcher,
  Side,
  OrderType,
  MarketType,
  ConsoleLogger,
  getContractAddress,
} from 'limitless-exchange-ts-sdk';

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL || 'https://api.limitless.exchange';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '8453'); // Base mainnet

// Contract addresses - use SDK defaults or override with env var
const NEGRISK_CONTRACT_ADDRESS =
  process.env.NEGRISK_CONTRACT_ADDRESS || getContractAddress('NEGRISK', CHAIN_ID);

// NegRisk group market example
const NEGRISK_GROUP_SLUG = 'largest-company-end-of-2025-1746118069282';

async function main() {
  console.log('🚀 NegRisk Group Market Trading Example\n');

  // Show configuration
  console.log('⚙️  Configuration:');
  console.log(`   API URL: ${API_URL}`);
  console.log(`   Chain ID: ${CHAIN_ID}`);
  console.log(`   NegRisk Contract: ${NEGRISK_CONTRACT_ADDRESS}\n`);

  // Validate environment
  const privateKey = process.env.PRIVATE_KEY;
  if (
    !privateKey ||
    privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    throw new Error('Please set PRIVATE_KEY in .env file');
  }

  const logger = new ConsoleLogger('info');

  try {
    // ===========================================
    // STEP 1: Setup Authentication
    // ===========================================
    console.log('📝 Step 1: Authenticating...');

    const wallet = new ethers.Wallet(privateKey);
    console.log(`   Wallet: ${wallet.address}`);

    const httpClient = new HttpClient({
      baseURL: API_URL,
      timeout: 30000,
    });

    const signer = new MessageSigner(wallet);
    const authenticator = new Authenticator(httpClient, signer, logger);

    const authResult = await authenticator.authenticate({
      client: 'eoa',
    });

    console.log(`   ✅ Authenticated as: ${authResult.profile.account}`);

    // Extract user data from auth result
    // Note: The API response contains userId and rank.feeRateBps
    const userData = {
      userId: (authResult.profile as any).id || 1,
      feeRateBps: (authResult.profile as any).rank?.feeRateBps || 300,
    };

    console.log(`   User ID: ${userData.userId}`);
    console.log(`   Fee Rate: ${userData.feeRateBps / 100}%\n`);

    // ===========================================
    // STEP 2: Fetch NegRisk Group Market
    // ===========================================
    console.log('📊 Step 2: Fetching NegRisk Group Market...');

    const marketFetcher = new MarketFetcher(httpClient, logger);
    const groupMarketResponse = await marketFetcher.getMarket(NEGRISK_GROUP_SLUG);

    // Cast to any to access properties not in the Market type definition
    // The API returns these fields but they're not in the SDK type yet
    const groupMarket = groupMarketResponse as any;

    console.log('📦 Group Market Details:');
    console.log('   Title:', groupMarket.title);
    console.log('   Type:', groupMarket.marketType); // "group" for NegRisk
    console.log('   Trade Type:', groupMarket.tradeType); // "clob"
    console.log('   Expiration:', groupMarket.expirationDate);
    console.log('   Total Volume:', groupMarket.volumeFormatted, 'USDC');
    console.log('   Daily Rewards:', groupMarket.dailyReward || 'N/A', 'USDC');
    console.log('   Number of Submarkets:', groupMarket.markets?.length || 0, '\n');

    // ===========================================
    // STEP 3: Browse Submarkets
    // ===========================================
    console.log('🔍 Step 3: Exploring Submarkets...\n');

    if (!groupMarket.markets || groupMarket.markets.length === 0) {
      console.log('   ⚠️  No submarkets found in this group');
      return;
    }

    // Display all submarkets
    console.log('📋 Available Submarkets:');
    groupMarket.markets.forEach((submarket: any, index: number) => {
      console.log(`\n   ${index + 1}. ${submarket.title}`);
      console.log(`      Slug: ${submarket.slug}`);
      console.log(`      Type: ${submarket.marketType}`); // "single" for individual NegRisk markets
      console.log(`      Volume: ${submarket.volumeFormatted} USDC`);
      console.log(`      Prices: Yes=${submarket.prices?.[0]} | No=${submarket.prices?.[1]}`);
      console.log(
        `      Trade Prices (Buy Market): Yes=${submarket.tradePrices?.buy?.market?.[0]} | No=${submarket.tradePrices?.buy?.market?.[1]}`
      );
    });

    // ===========================================
    // STEP 4: Get Orderbook for Specific Submarket
    // ===========================================
    console.log('\n\n📖 Step 4: Fetching Orderbook for First Submarket...');

    // Pick first submarket as example
    const exampleSubmarket = groupMarket.markets[0] as any;
    console.log(`\n   Selected: ${exampleSubmarket.title} (${exampleSubmarket.slug})`);

    // Fetch orderbook for this specific submarket
    const orderbook = await marketFetcher.getOrderBook(exampleSubmarket.slug);

    console.log('\n   📊 Orderbook:');
    console.log(`      Bids: ${orderbook.bids.length} levels`);
    console.log(`      Asks: ${orderbook.asks.length} levels`);

    if (orderbook.bids.length > 0 && orderbook.asks.length > 0) {
      console.log(
        `\n      Best Bid: ${orderbook.bids[0].price} (${orderbook.bids[0].size} shares)`
      );
      console.log(`      Best Ask: ${orderbook.asks[0].price} (${orderbook.asks[0].size} shares)`);

      const spread = orderbook.asks[0].price - orderbook.bids[0].price;
      const spreadPercent = (spread / orderbook.bids[0].price) * 100;
      console.log(`      Spread: ${spread.toFixed(4)} (${spreadPercent.toFixed(2)}%)`);
    }

    // ===========================================
    // STEP 5: Get Detailed Submarket Info
    // ===========================================
    console.log(`\n\n📊 Step 5: Fetching Detailed Info for ${exampleSubmarket.title}...`);

    // Get detailed info - the API returns additional fields not in the Market type
    const detailedInfoResponse = await marketFetcher.getMarket(`${exampleSubmarket.slug}`);
    const detailedInfo = detailedInfoResponse as any;

    console.log('\n   📋 Detailed Market Info:');
    console.log(`      Condition ID: ${detailedInfo.conditionId}`);
    console.log(`      NegRisk Request ID: ${detailedInfo.negRiskRequestId}`);
    console.log(`      Status: ${detailedInfo.status}`);
    console.log(`      Rewardable: ${detailedInfo.isRewardable}`);
    console.log(`      Daily Reward: ${detailedInfo.settings?.dailyReward || 'N/A'} USDC`);
    console.log(
      `      Min Size: ${detailedInfo.settings?.minSize ? (Number(detailedInfo.settings.minSize) / 1e6).toFixed(2) : 'N/A'} USDC`
    );
    console.log(`      Max Spread: ${detailedInfo.settings?.maxSpread || 'N/A'}`);

    // Token IDs for YES and NO outcomes
    console.log(`\n      Token IDs:`);
    console.log(`         YES: ${detailedInfo.tokens?.yes}`);
    console.log(`         NO: ${detailedInfo.tokens?.no}`);

    // ===========================================
    // STEP 6: Place Order on NegRisk Submarket
    // ===========================================
    console.log('\n\n💰 Step 6: Placing Order on NegRisk Submarket...');

    // Setup order client for NegRisk markets
    const orderClient = new OrderClient({
      httpClient,
      wallet,
      userData,
      marketType: MarketType.NEGRISK,
      logger,
    });

    console.log('\n   📝 Order Details:');
    console.log(`      Market: ${exampleSubmarket.title}`);
    console.log(`      Submarket Slug: ${exampleSubmarket.slug}`);
    console.log(`      Token: YES`);
    console.log(`      Side: BUY`);
    console.log(`      Type: GTC (Limit Order)`);
    console.log(`      Price: 0.50 (50%)`);
    console.log(`      Size: 10 shares`);

    // IMPORTANT: For NegRisk markets, use the SUBMARKET slug, not the group slug
    // The order placement uses MarketType.NEGRISK for proper signature
    const orderResponse = await orderClient.createOrder({
      tokenId: detailedInfo.tokens.yes, // YES token ID from submarket
      price: 0.1, // Limit price
      size: 10, // Number of shares
      side: Side.BUY,
      orderType: OrderType.GTC,
      marketSlug: exampleSubmarket.slug, // ← Use submarket slug, not group slug!
    });

    console.log('\n✅ Order Placed Successfully!');
    console.log(`   Order ID: ${orderResponse.order.id}`);
    console.log(`   Created at: ${orderResponse.order.createdAt}`);
    console.log(`   Market ID: ${orderResponse.order.marketId}`);
    console.log(`   Maker Amount: ${orderResponse.order.makerAmount}`);
    console.log(`   Taker Amount: ${orderResponse.order.takerAmount}`);

    // Print full response for inspection
    console.log('\n📋 Full Order Response:');
    console.log(JSON.stringify(orderResponse, null, 2));

    // Check if order was partially matched
    if (orderResponse.makerMatches && orderResponse.makerMatches.length > 0) {
      console.log(`\n   🎯 Order was PARTIALLY MATCHED!`);
      console.log(`   Matches: ${orderResponse.makerMatches.length}`);
      orderResponse.makerMatches.forEach((match, index) => {
        console.log(`\n   Match ${index + 1}:`);
        console.log(`     Match ID: ${match.id}`);
        console.log(`     Matched Size: ${match.matchedSize}`);
        console.log(`     Order ID: ${match.orderId}`);
        console.log(`     Matched at: ${match.createdAt}`);
      });
      console.log(`\n   Remaining order will stay on orderbook until filled or cancelled`);
    } else {
      console.log(`\n   📋 Order placed on orderbook (no immediate matches)`);
      console.log(`   Order will remain active until filled or manually cancelled`);
    }

    // ===========================================
    // STEP 7: Place SELL Order on NegRisk Submarket
    // ===========================================
    console.log('\n\n' + '='.repeat(60));
    console.log('📤 STEP 7: Placing SELL Order on NegRisk Submarket');
    console.log('='.repeat(60));

    const sellOrderParams = {
      tokenId: detailedInfo.tokens.yes,
      price: 0.999, // Higher price to stay on orderbook
      size: 1.349,
      side: Side.SELL,
    };

    console.log('\n📋 SELL Order Configuration:');
    console.log(`   Market: ${exampleSubmarket.title}`);
    console.log(`   Submarket Slug: ${exampleSubmarket.slug}`);
    console.log(`   Token ID: ${sellOrderParams.tokenId}`);
    console.log(`   Side: SELL`);
    console.log(`   Price: ${sellOrderParams.price}`);
    console.log(`   Size: ${sellOrderParams.size} shares`);
    console.log(`   Type: GTC (order will remain on orderbook)\n`);

    console.log('📤 Creating and submitting SELL order...');

    const sellOrderResponse = await orderClient.createOrder({
      ...sellOrderParams,
      orderType: OrderType.GTC,
      marketSlug: exampleSubmarket.slug,
    });

    console.log('   ✅ SELL Order submitted successfully!');
    console.log(`   Order ID: ${sellOrderResponse.order.id}`);
    console.log(`   Created at: ${sellOrderResponse.order.createdAt}`);
    console.log(`   Market ID: ${sellOrderResponse.order.marketId}`);

    // Print full SELL order response
    console.log('\n📋 Full SELL Order Response:');
    console.log(JSON.stringify(sellOrderResponse, null, 2));

    // Check if SELL order was partially matched
    if (sellOrderResponse.makerMatches && sellOrderResponse.makerMatches.length > 0) {
      console.log(`\n   🎯 SELL Order was PARTIALLY MATCHED!`);
      console.log(`   Matches: ${sellOrderResponse.makerMatches.length}`);
      sellOrderResponse.makerMatches.forEach((match, index) => {
        console.log(`\n   Match ${index + 1}:`);
        console.log(`     Match ID: ${match.id}`);
        console.log(`     Matched Size: ${match.matchedSize}`);
        console.log(`     Order ID: ${match.orderId}`);
        console.log(`     Matched at: ${match.createdAt}`);
      });
      console.log(`\n   Remaining SELL order will stay on orderbook until filled or cancelled`);
    } else {
      console.log(`\n   📋 SELL Order placed on orderbook (no immediate matches)`);
      console.log(`   Order will remain active until filled or manually cancelled`);
    }

    // ===========================================
    // STEP 8: View Updated Orderbook
    // ===========================================
    console.log('\n🔍 Step 8: Fetching updated orderbook to verify both orders...');

    const updatedOrderbook = await marketFetcher.getOrderBook(exampleSubmarket.slug);

    console.log(`   Bids: ${updatedOrderbook.bids.length} orders`);
    console.log(`   Asks: ${updatedOrderbook.asks.length} orders`);
    console.log(`   Min size: ${updatedOrderbook.minSize}`);

    // Find our BUY order
    const ourBuyOrder = updatedOrderbook.bids.find((order) => Math.abs(order.price - 0.1) < 0.001);
    if (ourBuyOrder) {
      console.log(`\n   ✅ Found BUY order on orderbook!`);
      console.log(`      Price: ${ourBuyOrder.price}`);
      console.log(`      Size: ${ourBuyOrder.size}`);
    }

    // Find our SELL order
    const ourSellOrder = updatedOrderbook.asks.find(
      (order) => Math.abs(order.price - sellOrderParams.price) < 0.001
    );
    if (ourSellOrder) {
      console.log(`\n   ✅ Found SELL order on orderbook!`);
      console.log(`      Price: ${ourSellOrder.price}`);
      console.log(`      Size: ${ourSellOrder.size}`);
    }

    // ===========================================
    // STEP 9: Cancel Orders Demo (Optional)
    // ===========================================
    console.log('\n\n' + '='.repeat(60));
    console.log('🗑️  STEP 9: Order Cancellation Demo (Optional)');
    console.log('='.repeat(60));
    console.log('\nThis step demonstrates order cancellation.');
    console.log('Uncomment the code below to test cancellation:\n');

    console.log('// Option 1: Cancel individual orders');
    console.log(`// const cancelBuy = await orderClient.cancel("${orderResponse.order.id}");`);
    console.log(`// console.log(cancelBuy.message);`);
    console.log(`//`);
    console.log(`// const cancelSell = await orderClient.cancel("${sellOrderResponse.order.id}");`);
    console.log(`// console.log(cancelSell.message);`);
    console.log('');
    console.log('// Option 2: Cancel all orders for this submarket');
    console.log(
      `// const cancelAllResult = await orderClient.cancelAll("${exampleSubmarket.slug}");`
    );
    console.log(`// console.log(cancelAllResult.message);`);

    // console.log("\n🗑️  Cancelling BUY order...");
    // const cancelBuyResult = await orderClient.cancel(orderResponse.order.id);
    // console.log(`   ✅ ${cancelBuyResult.message}`);

    // console.log("\n🗑️  Cancelling SELL order...");
    // const cancelSellResult = await orderClient.cancel(sellOrderResponse.order.id);
    // console.log(`   ✅ ${cancelSellResult.message}`);

    // console.log("\n🗑️  Cancelling all orders for submarket...");
    // const cancelAllResult = await orderClient.cancelAll(exampleSubmarket.slug);
    // console.log(`   ✅ ${cancelAllResult.message}`);

    // ===========================================
    // STEP 10: Summary
    // ===========================================
    console.log('\n🎉 NegRisk order example completed successfully!');
    console.log('\n📚 Summary:');
    console.log(`   - BUY Order ID: ${orderResponse.order.id} (Price: 0.1)`);
    console.log(
      `   - SELL Order ID: ${sellOrderResponse.order.id} (Price: ${sellOrderParams.price})`
    );
    console.log('\n📚 Cancellation Methods:');
    console.log('   - orderClient.cancel(orderId) - Cancel single order');
    console.log('   - orderClient.cancelAll(marketSlug) - Cancel all orders for submarket');
    console.log('\n💡 Tip: Orders stay on the orderbook until:');
    console.log('   1. Fully matched by another order');
    console.log('   2. Manually cancelled');
    console.log('   3. Market is resolved');

    // ===========================================
    // STEP 11: Key Differences Summary
    // ===========================================
    console.log('\n\n📚 Key Differences: NegRisk vs Standard CLOB');
    console.log('='.repeat(60));

    console.log('\n1️⃣  Market Structure:');
    console.log("   CLOB:    marketType = 'single' (one outcome)");
    console.log("   NegRisk: marketType = 'group' (multiple related outcomes)");

    console.log('\n2️⃣  Fetching Markets:');
    console.log('   Group:    GET /markets/{group-slug}');
    console.log('   Submarket: Access via groupMarket.markets[] array');

    console.log('\n3️⃣  Orderbooks:');
    console.log('   Group:     No orderbook (container only)');
    console.log('   Submarket: GET /markets/{submarket-slug}/orderbook');

    console.log('\n4️⃣  Placing Orders:');
    console.log("   Use submarket slug (e.g., 'nvidia-1746118069310')");
    console.log("   NOT group slug (e.g., 'largest-company-end-of-2025-1746118069282')");
    console.log('   Everything else is the same as CLOB!');

    console.log('\n5️⃣  Token IDs:');
    console.log('   Each submarket has its own YES/NO token IDs');
    console.log('   Get from: submarket.tokens.yes or submarket.tokens.no');

    console.log('\n\n✅ Example Complete!');
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
