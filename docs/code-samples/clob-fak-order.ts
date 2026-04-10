/**
 * FAK (Fill-And-Kill) Order Placement Example
 *
 * This example demonstrates how to:
 * 1. Initialize SDK with API key authentication
 * 2. Build a FAK limit order with price + size
 * 3. Submit an order that can fill immediately up to the requested size
 * 4. Inspect whether any portion matched before the remainder was cancelled
 *
 * FAK orders use the same tick-aligned price + size math as GTC orders.
 * The difference is execution behavior: any unmatched remainder is killed
 * immediately instead of resting on the orderbook.
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
} from '@limitless-exchange/sdk';

config();

const API_URL = process.env.API_URL || 'https://api.limitless.exchange';

async function main() {
  console.log('🚀 FAK (Fill-And-Kill) Order Placement Example\n');

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

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Please set PRIVATE_KEY in .env file');
  }

  const logger = new ConsoleLogger('info');

  try {
    console.log('🔐 Step 1: Initializing HTTP client and wallet...');

    const httpClient = new HttpClient({
      baseURL: API_URL,
      apiKey,
      timeout: 30000,
      logger,
    });

    const wallet = new ethers.Wallet(privateKey);
    console.log(`   ✅ Wallet initialized: ${wallet.address}\n`);

    console.log('📊 Step 2: Fetching market details...');

    const marketFetcher = new MarketFetcher(httpClient);
    const market = await marketFetcher.getMarket(marketSlug);

    if (!market.tokens?.yes) {
      throw new Error('Market has no YES token');
    }

    const tokenId = String(market.tokens.yes);
    console.log(`   Market: ${market.title}`);
    console.log(`   Token ID (YES): ${tokenId}\n`);

    console.log('📋 Step 3: Configuring FAK order...');

    const orderParams = {
      tokenId,
      price: 0.45, // Maximum price willing to pay
      size: 10, // Shares to buy
      side: Side.BUY,
    };

    console.log(`   Side: ${orderParams.side === Side.BUY ? 'BUY' : 'SELL'}`);
    console.log(`   Price: ${orderParams.price}`);
    console.log(`   Size: ${orderParams.size} shares`);
    console.log('   Type: FAK (fills what it can, kills remainder)');
    console.log('   Note: postOnly is not supported for FAK orders\n');

    console.log('🔨 Step 4: Creating order client...');

    const orderClient = new OrderClient({
      httpClient,
      wallet,
    });

    console.log('📤 Step 5: Creating and submitting FAK order...');

    const orderResponse = await orderClient.createOrder({
      ...orderParams,
      orderType: OrderType.FAK,
      marketSlug,
    });

    console.log('   ✅ Order submitted successfully!');
    console.log(`   Order ID: ${orderResponse.order.id}`);
    console.log(`   Created at: ${orderResponse.order.createdAt}`);

    console.log('\n📋 Full Order Response:');
    console.log(JSON.stringify(orderResponse, null, 2));

    if (orderResponse.makerMatches && orderResponse.makerMatches.length > 0) {
      console.log(`\n   🎯 FAK matched immediately with ${orderResponse.makerMatches.length} fill(s)`);
    } else {
      console.log('\n   ⚠️  No immediate fills. The remainder was cancelled by FAK semantics.');
    }

  } catch (error) {
    console.error('\n❌ Error occurred');
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    } else {
      console.error('   Unknown error:', error);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
