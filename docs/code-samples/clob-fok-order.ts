/**
 * FOK (Fill-or-Kill) Order Placement Example
 *
 * This example demonstrates how to:
 * 1. Initialize SDK with API key authentication
 * 2. Create a FOK market order with makerAmount (USDC for BUY, shares for SELL)
 * 3. Submit order that executes immediately at best price or cancels
 *
 * FOK orders are market orders - you specify makerAmount (USDC to spend for BUY, shares to sell for SELL),
 * and the order fills at the best available price or cancels if not fully matched.
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
const API_URL = process.env.API_URL;
const CHAIN_ID = parseInt(process.env.CHAIN_ID); // Base mainnet

async function main() {
  console.log('🚀 FOK (Fill-or-Kill) Order Placement Example\n');

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
    console.log('📋 Step 3: Configuring FOK order...');

    // Example order parameters (adjust these for your market)
    // FOK orders are market orders - you specify makerAmount (USDC for BUY, shares for SELL)
    const orderParams = {
      tokenId, // Token ID from market
      makerAmount: 32.05, // BUY: 32.05 USDC to spend | SELL: 32.05 shares to sell
      side: Side.BUY, // BUY order
    };

    console.log(`   Side: ${orderParams.side === Side.BUY ? 'BUY' : 'SELL'}`);
    console.log(
      `   Maker Amount: ${orderParams.makerAmount} ${orderParams.side === Side.BUY ? 'USDC' : 'shares'}`
    );
    console.log(`   Type: FOK (market order - executes immediately at best price)\n`);

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
    // STEP 4: Create and Submit FOK Order
    // ===========================================
    console.log('📤 Step 4: Creating and submitting FOK order...');

    const orderResponse = await orderClient.createOrder({
      ...orderParams,
      orderType: OrderType.FOK,
      marketSlug,
    });

    console.log('   ✅ Order submitted successfully!');
    console.log(`   Order ID: ${orderResponse.order.id}`);
    console.log(`   Created at: ${orderResponse.order.createdAt}`);
    console.log(`   Market ID: ${orderResponse.order.marketId}`);

    // Print full response for inspection
    console.log('\n📋 Full Order Response:');
    console.log(JSON.stringify(orderResponse, null, 2));

    // Check if order was matched (FOK orders execute immediately or cancel)
    if (orderResponse.makerMatches && orderResponse.makerMatches.length > 0) {
      console.log(`\n   🎯 Order was MATCHED!`);
      console.log(`   Matches: ${orderResponse.makerMatches.length}`);
      orderResponse.makerMatches.forEach((match, index) => {
        console.log(`\n   Match ${index + 1}:`);
        console.log(`     Match ID: ${match.id}`);
        console.log(`     Matched Size: ${match.matchedSize}`);
        console.log(`     Order ID: ${match.orderId}`);
        console.log(`     Matched at: ${match.createdAt}`);
      });
    } else {
      console.log(`\n   ⚠️  Order was NOT matched (cancelled as per FOK behavior)`);
    }

    console.log('\n🎉 FOK order example completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('   - Try GTC orders: pnpm run start:gtc-order');
    console.log('   - View orderbook: pnpm run start:orderbook');
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
