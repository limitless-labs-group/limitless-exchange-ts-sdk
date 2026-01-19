/**
 * Trading Workflow with Clean Fluent API
 *
 * Demonstrates a complete trading workflow using the improved fluent API.
 * Shows how to:
 * 1. Fetch market details
 * 2. Check existing orders using fluent API
 * 3. Place new orders
 * 4. Monitor order status using fluent API
 */

// Load environment variables if dotenv is available
try {
  await import('dotenv/config');
} catch {
  // dotenv not available - will use process.env directly
}

import { ethers } from 'ethers';
import { HttpClient, MarketFetcher, OrderClient, Side, OrderType } from '../../src';

async function fluentTradingWorkflow() {
  console.log('🚀 Trading Workflow with Clean Fluent API\n');

  // Validate required environment variables
  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Please set LIMITLESS_API_KEY in .env file\n' +
        'Get your API key from: https://limitless.exchange'
    );
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Please set PRIVATE_KEY in .env file');
  }

  // Setup
  const httpClient = new HttpClient({
    baseURL: process.env.API_URL || 'https://api.limitless.exchange',
    apiKey,
  });

  const wallet = new ethers.Wallet(privateKey);
  const marketFetcher = new MarketFetcher(httpClient);

  // 1. Fetch market (returns Market class instance)
  console.log('1️⃣ Fetching market details...');
  const marketSlug = process.env.MARKET_SLUG || 'bitcoin-2024';
  const market = await marketFetcher.getMarket(marketSlug);

  console.log(`✅ Market: ${market.title}`);
  console.log(`   Type: ${market.marketType}`);
  console.log(`   YES Token: ${market.tokens?.yes}`);
  console.log(`   NO Token: ${market.tokens?.no}\n`);

  // 2. Check existing orders using clean fluent API
  console.log('2️⃣ Checking existing orders...');
  const existingOrders = await market.getUserOrders();

  console.log(`✅ Found ${existingOrders.length} existing orders\n`);

  if (existingOrders.length > 0) {
    const openOrders = existingOrders.filter((o) => o.status === 'OPEN');
    console.log(`   Open orders: ${openOrders.length}`);

    openOrders.slice(0, 3).forEach((order, index) => {
      console.log(
        `   ${index + 1}. ${order.side} ${order.size} @ ${order.price} (${order.status})`
      );
    });
    console.log('');
  }

  // 3. Setup OrderClient
  console.log('3️⃣ Setting up order client...');
  const orderClient = new OrderClient({
    httpClient,
    wallet,
    marketFetcher, // Share instance for venue caching
  });
  console.log('✅ Order client ready\n');
  console.log('   User data will be fetched automatically on first order');

  // 4. Place a limit order (example - adjust parameters as needed)
  if (process.env.PLACE_ORDER === 'true') {
    console.log('4️⃣ Placing limit order...');
    try {
      const order = await orderClient.createOrder({
        tokenId: market.tokens!.yes,
        price: 0.55,
        size: 10,
        side: Side.BUY,
        orderType: OrderType.GTC,
        marketSlug: market.slug,
      });

      console.log(`✅ Order placed: ${order.id}`);
      console.log(`   Side: ${order.side}`);
      console.log(`   Price: ${order.price}`);
      console.log(`   Size: ${order.size}\n`);
    } catch (error: any) {
      console.log(`⚠️  Order placement skipped: ${error.message}\n`);
    }
  } else {
    console.log('4️⃣ Order placement skipped (set PLACE_ORDER=true to enable)\n');
  }

  // 5. Check updated orders using fluent API
  console.log('5️⃣ Checking updated orders...');
  const updatedOrders = await market.getUserOrders();

  console.log(`✅ Total orders: ${updatedOrders.length}`);

  // Analyze order distribution
  const statusCounts = updatedOrders.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('\n📊 Order Status Distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  // Show recent activity
  console.log('\n📋 Recent Orders:');
  updatedOrders
    .slice(0, 5)
    .reverse()
    .forEach((order, index) => {
      const filledInfo = order.filled ? ` (${order.filled}/${order.size} filled)` : '';
      console.log(
        `   ${index + 1}. ${order.side} ${order.size} @ ${order.price} - ${order.status}${filledInfo}`
      );
    });

  console.log('\n✨ Fluent API Benefits Demonstrated:');
  console.log('   ✅ Single market.getUserOrders() call - no marketSlug needed');
  console.log('   ✅ Market instance preserves context across operations');
  console.log('   ✅ Clean, readable code with less repetition');
  console.log('   ✅ Type-safe market properties (tokens, venue, etc.)');
}

// Run the workflow
fluentTradingWorkflow()
  .then(() => {
    console.log('\n✅ Workflow completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  });
