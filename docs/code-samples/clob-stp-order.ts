/**
 * Self-Trade Prevention (STP) Order Example
 *
 * This example demonstrates how to:
 * 1. Initialize SDK with API key authentication
 * 2. Place a resting GTC order
 * 3. Place a crossing order from the SAME account with an `stpPolicy`
 * 4. Read the `execution` object on the response to see the STP outcome
 *
 * Self-trade prevention controls what happens when your incoming order would
 * match against your own resting order:
 *   - cancel_both  — cancel the resting maker order AND the incoming taker order
 *   - cancel_maker — cancel the resting maker order, let the taker keep matching
 *   - cancel_taker — cancel the incoming taker order, leave the maker resting
 *
 * Omit `stpPolicy` to use the venue default (`cancel_maker`).
 *
 * The `stpPolicy` field is sent top-level on the request body. It is never
 * part of the signed EIP-712 order, so it does not affect the signature.
 *
 * Where the STP outcome shows up:
 *   - HTTP response: `response.execution.reason` (e.g. `STP_TAKER_REJECTED`) and
 *     `response.execution.stpMakerCancels` (UUIDs of canceled maker orders).
 *   - WebSocket: a `CANCELLATION` order event carries `reason: STP_MAKER_CANCELLED`
 *     for each maker order STP canceled. The taker reject is HTTP-only.
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

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL || 'https://api.limitless.exchange';

async function main() {
  console.log('🚀 Self-Trade Prevention (STP) Order Example\n');

  // Show configuration
  console.log('⚙️  Configuration:');
  console.log(`   API URL: ${API_URL}`);

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

    if (!market.tokens || !market.tokens.yes) {
      throw new Error('Market has no YES token');
    }

    const tokenId = String(market.tokens.yes);
    console.log(`   Token ID (YES): ${tokenId}\n`);

    // ===========================================
    // STEP 3: Create Order Client
    // ===========================================
    console.log('🔨 Step 3: Creating order client...');

    const orderClient = new OrderClient({
      httpClient,
      wallet,
    });

    console.log('   ✅ Order client ready\n');

    // ===========================================
    // STEP 4: Place a Resting Maker Order
    // ===========================================
    console.log('📤 Step 4: Placing a resting BUY GTC order...');

    const restingOrder = await orderClient.createOrder({
      tokenId,
      price: 0.6, // BUY at 0.60
      size: 100,
      side: Side.BUY,
      orderType: OrderType.GTC,
      marketSlug,
    });

    console.log('   ✅ Resting order placed');
    console.log(`   Order ID: ${restingOrder.order.id}`);
    if (restingOrder.execution) {
      console.log(`   Settlement status: ${restingOrder.execution.settlementStatus}\n`);
    }

    // ===========================================
    // STEP 5: Place a Crossing Order With STP
    // ===========================================
    console.log('📤 Step 5: Placing a crossing SELL order from the SAME account...');
    console.log('   stpPolicy: cancel_taker (reject the incoming order, keep the maker resting)\n');

    const crossingOrder = await orderClient.createOrder({
      tokenId,
      price: 0.6, // SELL at 0.60 — crosses our own resting BUY
      size: 100,
      side: Side.SELL,
      orderType: OrderType.GTC,
      marketSlug,
      stpPolicy: 'cancel_taker',
    });

    console.log('   ✅ Crossing order submitted\n');

    // ===========================================
    // STEP 6: Read the Execution Result
    // ===========================================
    console.log('🔍 Step 6: Inspecting the execution result...');

    const execution = crossingOrder.execution;
    if (execution) {
      console.log(`   Matched: ${execution.matched}`);
      console.log(`   Settlement status: ${execution.settlementStatus}`);
      console.log(`   Fee rate (bps): ${execution.feeRateBps}`);
      console.log(`   Effective fee (bps): ${execution.effectiveFeeBps}`);

      // STP taker signal is delivered on the HTTP response only.
      if (execution.reason) {
        console.log(`   Reason: ${execution.reason}`); // e.g. STP_TAKER_REJECTED
      }

      // UUIDs of maker orders that STP canceled (when stpPolicy cancels makers).
      if (execution.stpMakerCancels && execution.stpMakerCancels.length > 0) {
        console.log(`   STP canceled maker orders: ${execution.stpMakerCancels.join(', ')}`);
      }

      // Raw totals are decimal STRINGS — do not coerce.
      console.log('   Totals (raw decimal strings):');
      console.log(`     contractsGross: ${execution.totalsRaw.contractsGross}`);
      console.log(`     contractsNet:   ${execution.totalsRaw.contractsNet}`);
      console.log(`     usdGross:       ${execution.totalsRaw.usdGross}`);
      console.log(`     usdNet:         ${execution.totalsRaw.usdNet}`);
    } else {
      console.log('   ⚠️  No execution object on the response (older API).');
    }

    console.log('\n📋 Full Crossing Order Response:');
    console.log(JSON.stringify(crossingOrder, null, 2));

    console.log('\n🎉 STP order example completed successfully!');
    console.log('\n📚 Key points:');
    console.log('   - stpPolicy is top-level and never affects the order signature');
    console.log('   - cancel_both / cancel_maker / cancel_taker control the outcome');
    console.log('   - execution.reason and execution.stpMakerCancels report the STP result');
    console.log('   - On WebSocket, STP maker cancels arrive as CANCELLATION + reason=STP_MAKER_CANCELLED');
  } catch (error) {
    console.error('\n❌ Error occurred');

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
