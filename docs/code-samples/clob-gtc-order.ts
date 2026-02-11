/**
 * GTC (Good-Til-Cancelled) Order Placement Example
 *
 * This example demonstrates how to:
 * 1. Initialize SDK with API key authentication
 * 2. Build a GTC order (stays on orderbook until filled or cancelled)
 * 3. Submit the order
 * 4. Query the orderbook to see the order
 *
 * IMPORTANT - Tick Alignment Requirements:
 * - Prices must have max 3 decimal places (e.g., 0.380, 0.001)
 * - Size must be tick-aligned to produce valid contract amounts
 * - SDK validates inputs and provides clear error messages with suggestions
 * - NO AUTO-ROUNDING: Better to fail with helpful errors than surprise users
 * - This ensures price * contracts yields whole number in collateral units
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import {
  HttpClient,
  OrderClient,
  MarketFetcher,
  PortfolioFetcher,
  Side,
  OrderType,
  ConsoleLogger,
} from '@limitless-exchange/sdk';

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL;
const CHAIN_ID = parseInt(process.env.CHAIN_ID); // Base mainnet

async function main() {
  console.log('🚀 GTC (Good-Til-Cancelled) Order Placement Example\n');

  // Show configuration
  console.log('⚙️  Configuration:');
  console.log(`   API URL: ${API_URL}`);
  console.log(`   Chain ID: ${CHAIN_ID}`);

  // Validate API key
  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Please set LIMITLESS_API_KEY in .env file\n' +
        'Get your API key from: https://limitless.exchange'
    );
  }

  const marketSlug = process.env.MARKET_SLUG;
  if (!marketSlug) {
    throw new Error('Please set MARKET_SLUG in .env file');
  }

  // Validate private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Please set PRIVATE_KEY in .env file');
  }

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
    // STEP 2: Fetch Market and Get Token ID
    // ===========================================
    console.log('📊 Step 2: Fetching market details...');

    const marketFetcher = new MarketFetcher(httpClient);
    const market = await marketFetcher.getMarket(marketSlug);

    console.log(`   Market: ${market.title}`);
    console.log(`   Type: ${market.marketType}\n`);

    // Get YES token ID from market
    if (!market.tokens || !market.tokens.yes) {
      throw new Error('Market has no YES token');
    }

    const tokenId = String(market.tokens.yes);
    console.log(`   Token ID (YES): ${tokenId}\n`);

    // ===========================================
    // STEP 3: Order Configuration
    // ===========================================
    console.log('📋 Step 3: Configuring GTC order...');

    // Example order parameters (adjust these for your market)
    const orderParams = {
      tokenId, // Token ID from market
      price: 0.123, // 12.3% probability - lower than market to stay on orderbook
      size: 100, // 100 shares
      side: Side.BUY, // BUY order
    };

    console.log(`   Side: ${orderParams.side === Side.BUY ? 'BUY' : 'SELL'}`);
    console.log(`   Price: ${orderParams.price}`);
    console.log(`   Size: ${orderParams.size} shares`);
    console.log(`   Type: GTC (order will remain on orderbook)\n`);

    // ===========================================
    // STEP 4: Create Order Client
    // ===========================================
    console.log('🔨 Step 4: Creating order client...');

    const orderClient = new OrderClient({
      httpClient,
      wallet,
    });

    console.log('   ✅ Order client ready');
    console.log('   User data will be fetched automatically on first order\n');

    // ===========================================
    // STEP 5: Create and Submit Order
    // ===========================================
    console.log('📤 Step 5: Creating and submitting GTC order...');

    const orderResponse = await orderClient.createOrder({
      ...orderParams,
      orderType: OrderType.GTC,
      marketSlug,
    });

    console.log('   ✅ Order submitted successfully!');
    console.log(`   Order ID: ${orderResponse.order.id}`);
    console.log(`   Created at: ${orderResponse.order.createdAt}`);
    console.log(`   Market ID: ${orderResponse.order.marketId}`);

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
    // STEP 5: View Orderbook
    // ===========================================
    console.log('\n🔍 Step 5: Fetching orderbook to verify order...');

    const orderbook = await marketFetcher.getOrderBook(marketSlug);

    console.log(`   Bids: ${orderbook.bids.length} orders`);
    console.log(`   Asks: ${orderbook.asks.length} orders`);
    console.log(`   Min size: ${orderbook.minSize}`);

    // Find our order in the orderbook
    const ordersToCheck = orderParams.side === Side.BUY ? orderbook.bids : orderbook.asks;
    const ourOrder = ordersToCheck.find(
      (order) => Math.abs(order.price - orderParams.price) < 0.001
    );

    if (ourOrder) {
      console.log(`\n   ✅ Found our order on the orderbook!`);
      console.log(`      Side: ${ourOrder.side}`);
      console.log(`      Price: ${ourOrder.price}`);
      console.log(`      Size: ${ourOrder.size}`);
    } else {
      console.log(`\n   ⚠️  Order not found on orderbook (may have been immediately matched)`);
    }

    // ===========================================
    // STEP 6: Place SELL GTC Order
    // ===========================================
    console.log('\n\n' + '='.repeat(60));
    console.log('📤 STEP 6: Placing SELL GTC Order');
    console.log('='.repeat(60));

    const sellOrderParams = {
      tokenId: orderParams.tokenId,
      price: 0.999, // 75% probability - higher than market to stay on orderbook
      size: 1.349, // 10 shares
      side: Side.SELL,
    };

    console.log('\n📋 SELL Order Configuration:');
    console.log(`   Market: ${marketSlug}`);
    console.log(`   Token ID: ${sellOrderParams.tokenId}`);
    console.log(`   Side: SELL`);
    console.log(`   Price: ${sellOrderParams.price}`);
    console.log(`   Size: ${sellOrderParams.size} shares`);
    console.log(`   Type: GTC (order will remain on orderbook)\n`);

    console.log('📤 Creating and submitting SELL order...');

    const sellOrderResponse = await orderClient.createOrder({
      ...sellOrderParams,
      orderType: OrderType.GTC,
      marketSlug,
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
    // STEP 7: View Updated Orderbook
    // ===========================================
    console.log('\n🔍 Step 7: Fetching updated orderbook to verify both orders...');

    const updatedOrderbook = await marketFetcher.getOrderBook(marketSlug);

    console.log(`   Bids: ${updatedOrderbook.bids.length} orders`);
    console.log(`   Asks: ${updatedOrderbook.asks.length} orders`);
    console.log(`   Min size: ${updatedOrderbook.minSize}`);

    // Find our BUY order
    const ourBuyOrder = updatedOrderbook.bids.find(
      (order) => Math.abs(order.price - orderParams.price) < 0.001
    );
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
    // STEP 8: Advanced Order Methods
    // ===========================================
    console.log('\n\n' + '='.repeat(60));
    console.log('🔧 STEP 8: Advanced Order Methods');
    console.log('='.repeat(60));

    // 8a. Build Unsigned Order (without submitting)
    console.log('\n📝 Building unsigned order without submitting...');
    const unsignedOrder = await orderClient.buildUnsignedOrder({
      tokenId,
      price: 0.45,
      size: 5,
      side: Side.BUY,
    });

    console.log('   ✅ Unsigned order built:');
    console.log(`      Salt: ${unsignedOrder.salt}`);
    console.log(`      Maker: ${unsignedOrder.maker}`);
    console.log(`      MakerAmount: ${unsignedOrder.makerAmount}`);
    console.log(`      TakerAmount: ${unsignedOrder.takerAmount}`);

    // 8b. Get Wallet Address and Owner ID
    console.log('\n👤 Wallet and Owner Info:');
    console.log(`   Wallet Address: ${orderClient.walletAddress}`);
    console.log(`   Owner ID: ${orderClient.ownerId}`);

    // 8c. Get Venue from Cache (synchronous)
    console.log('\n🏛️  Getting venue from cache...');
    const venue = marketFetcher.getVenue(marketSlug);
    if (venue) {
      console.log('   ✅ Venue found in cache:');
      console.log(`      Exchange: ${venue.exchange}`);
      console.log(`      Adapter: ${venue.adapter}`);
    } else {
      console.log('   ⚠️  Venue not in cache (call getMarket first)');
    }

    // 8d. Get User History
    console.log('\n📜 Fetching user transaction history...');
    const portfolioFetcher = new PortfolioFetcher(httpClient);
    const history = await portfolioFetcher.getUserHistory(1, 5);
    console.log(`History resp: ${history}`);
    console.log(`   ✅ Found ${history.data.length} of ${history.totalCount} total entries`);
    if (history.data.length > 0) {
      console.log('\n   Recent transactions:');
      history.data.slice(0, 3).forEach((entry: any, i: number) => {
        console.log(`\n   ${i + 1}. ${entry.type}`);
        console.log(`      Market: ${entry.marketSlug || 'N/A'}`);
        console.log(`      Created: ${entry.createdAt}`);
      });
    }

    // ===========================================
    // STEP 9: Cancel Orders (Optional Demo)
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
    console.log('// Option 2: Cancel all orders for this market');
    console.log(`// const cancelAllResult = await orderClient.cancelAll("${marketSlug}");`);
    console.log(`// console.log(cancelAllResult.message);`);

    // console.log("\n🗑️  Cancelling BUY order...");
    // const cancelBuyResult = await orderClient.cancel(orderResponse.order.id);
    // console.log(`   ✅ ${cancelBuyResult.message}`);

    // console.log("\n🗑️  Cancelling SELL order...");
    // const cancelSellResult = await orderClient.cancel(sellOrderResponse.order.id);
    // console.log(`   ✅ ${cancelSellResult.message}`);

    // console.log("\n🗑️  Cancelling all orders for market...");
    // const cancelAllResult = await orderClient.cancelAll(marketSlug);
    // console.log(`   ✅ ${cancelAllResult.message}`);

    console.log('\n🎉 GTC order example completed successfully!');
    console.log('\n📚 Summary - What we demonstrated:');
    console.log('   1. Created BUY and SELL GTC orders');
    console.log('   2. Verified orders on the orderbook');
    console.log('   3. Built unsigned order (buildUnsignedOrder)');
    console.log('   4. Retrieved wallet address and owner ID');
    console.log('   5. Got venue from cache (getVenue)');
    console.log('   6. Fetched user transaction history');
    console.log('\n📚 Key SDK Methods Used:');
    console.log('   - orderClient.createOrder() - Submit orders');
    console.log('   - orderClient.buildUnsignedOrder() - Build without submitting');
    console.log('   - orderClient.walletAddress / ownerId - Get user info');
    console.log('   - orderClient.cancel() / cancelAll() - Cancel orders');
    console.log('   - marketFetcher.getMarket() - Get market details');
    console.log('   - marketFetcher.getVenue() - Get cached venue');
    console.log('   - marketFetcher.getOrderBook() - View orderbook');
    console.log('   - portfolioFetcher.getUserHistory() - Transaction history');
    console.log('\n💡 Tip: GTC orders stay on the orderbook until:');
    console.log('   1. Fully matched by another order');
    console.log('   2. Manually cancelled');
    console.log('   3. Market is resolved');
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
