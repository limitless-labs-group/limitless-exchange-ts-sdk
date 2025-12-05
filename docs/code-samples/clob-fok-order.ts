/**
 * FOK (Fill-or-Kill) Order Placement Example
 *
 * This example demonstrates how to:
 * 1. Authenticate with the API
 * 2. Create a FOK market order with amount (USDC collateral)
 * 3. Submit order that executes immediately at best price or cancels
 *
 * FOK orders are market orders - you specify the amount of USDC to spend/receive,
 * and the order fills at the best available price or cancels if not fully matched.
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import {
  HttpClient,
  MessageSigner,
  Authenticator,
  OrderClient,
  Side,
  OrderType,
  MarketType,
  ConsoleLogger,
  getContractAddress,
} from '@limitless-exchange/sdk';

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL;
const CHAIN_ID = parseInt(process.env.CHAIN_ID); // Base mainnet

// Contract addresses - use SDK defaults or override with env var
const CLOB_CONTRACT_ADDRESS =
  process.env.CLOB_CONTRACT_ADDRESS || getContractAddress('CLOB', CHAIN_ID);

async function main() {
  console.log('🚀 FOK (Fill-or-Kill) Order Placement Example\n');

  // Show configuration
  console.log('⚙️  Configuration:');
  console.log(`   API URL: ${API_URL}`);
  console.log(`   Chain ID: ${CHAIN_ID}`);
  console.log(`   CLOB Contract: ${CLOB_CONTRACT_ADDRESS}\n`);

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
    // STEP 1: Authentication
    // ===========================================
    console.log('🔐 Step 1: Authenticating...');
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
    // STEP 2: Order Configuration
    // ===========================================
    console.log('📋 Step 2: Configuring FOK order...');

    // Example order parameters (adjust these for your market)
    // FOK orders are market orders - you specify amount in human-readable USDC
    const orderParams = {
      tokenId: process.env.CLOB_POSITION_ID, // Example token ID - can be found in Market response YES/NO
      amount: 0.0007, // 1 USDC (human-readable, max 2 decimals: 1, 1.5, 10.25, etc.)
      side: Side.BUY, // BUY order
      marketType: MarketType.CLOB,
    };

    const marketSlug = process.env.CLOB_MARKET_SLUG; // Example market

    console.log(`   Market: ${marketSlug}`);
    console.log(`   Token ID: ${orderParams.tokenId}`);
    console.log(`   Side: ${orderParams.side === Side.BUY ? 'BUY' : 'SELL'}`);
    console.log(`   Amount: ${orderParams.amount} USDC`);
    console.log(`   Type: FOK (market order - executes immediately at best price)\n`);

    // ===========================================
    // STEP 3: Create Order Client
    // ===========================================
    console.log('🔨 Step 3: Creating order client...');

    // Option 1: Simple mode - auto-configures from marketType
    const orderClient = new OrderClient({
      httpClient,
      wallet,
      userData,
      marketType: MarketType.CLOB, // Auto-loads contract from env/defaults
      logger,
    });

    // Option 2:  Custom signing configuration
    // const orderClient = new OrderClient({
    //   httpClient,
    //   wallet,
    //   userData,
    //   signingConfig: {
    //     chainId: CHAIN_ID,
    //     contractAddress: CLOB_CONTRACT_ADDRESS,
    //     marketType: MarketType.CLOB,
    //   },
    //   logger,
    // });

    console.log('   ✅ Order client ready\n');

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
