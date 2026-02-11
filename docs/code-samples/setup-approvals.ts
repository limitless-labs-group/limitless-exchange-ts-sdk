/**
 * Token Approval Setup Example
 *
 * This example demonstrates how to set up token approvals before trading on Limitless Exchange.
 * You need to approve tokens ONCE per wallet before placing orders.
 *
 * IMPORTANT - Approval Requirements:
 *
 * CLOB Markets:
 * - BUY orders: Approve USDC → venue.exchange
 * - SELL orders: Approve CT → venue.exchange
 *
 * NegRisk Markets:
 * - BUY orders: Approve USDC → venue.exchange
 * - SELL orders: Approve CT → venue.exchange AND venue.adapter (TWO approvals!)
 *
 * These approvals are permanent (until revoked) and only need to be set once per wallet.
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import {
  HttpClient,
  MarketFetcher,
  getContractAddress,
  Side,
  ConsoleLogger,
} from '@limitless-exchange/sdk';

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL || 'https://api.limitless.exchange';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '8453'); // Base mainnet

/**
 * ERC-20 approve ABI (for USDC)
 */
const ERC20_APPROVE_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
];

/**
 * ERC-1155 setApprovalForAll ABI (for Conditional Tokens)
 */
const ERC1155_APPROVAL_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'operator', type: 'address' },
      { internalType: 'bool', name: 'approved', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address', name: 'operator', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main() {
  console.log('🔐 Token Approval Setup for Limitless Exchange\n');

  // Show configuration
  console.log('⚙️  Configuration:');
  console.log(`   API URL: ${API_URL}`);
  console.log(`   Chain ID: ${CHAIN_ID}\n`);

  // Validate environment
  const privateKey = process.env.PRIVATE_KEY;
  if (
    !privateKey ||
    privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    throw new Error('Please set PRIVATE_KEY in .env file');
  }

  const marketSlug = process.env.MARKET_SLUG;
  if (!marketSlug) {
    throw new Error('Please set MARKET_SLUG in .env file');
  }

  const logger = new ConsoleLogger('info');

  try {
    // ===========================================
    // STEP 1: Setup Wallet and Contracts
    // ===========================================
    console.log('🔧 Step 1: Setting up wallet and contracts...');

    const wallet = new ethers.Wallet(privateKey);
    console.log(`   Wallet: ${wallet.address}`);

    // Get contract addresses from SDK constants
    const usdcAddress = getContractAddress('USDC', CHAIN_ID);
    const ctfAddress = getContractAddress('CTF', CHAIN_ID);

    console.log(`   USDC: ${usdcAddress}`);
    console.log(`   CTF: ${ctfAddress}\n`);

    // Create contract instances
    const usdc = new ethers.Contract(usdcAddress, ERC20_APPROVE_ABI, wallet);
    const ctf = new ethers.Contract(ctfAddress, ERC1155_APPROVAL_ABI, wallet);

    // ===========================================
    // STEP 2: Fetch Market and Venue Info
    // ===========================================
    console.log('📊 Step 2: Fetching market and venue information...');

    const httpClient = new HttpClient({
      baseURL: API_URL,
      timeout: 30000,
    });

    const marketFetcher = new MarketFetcher(httpClient, logger);
    const market = await marketFetcher.getMarket(marketSlug);

    if (!market.venue) {
      throw new Error('Market does not have venue information');
    }

    console.log(`   Market: ${market.title}`);
    console.log(`   Market Type: ${market.marketType}`);
    console.log(`   Trade Type: ${market.tradeType}`);
    console.log(`   Venue Exchange: ${market.venue.exchange}`);
    console.log(`   Venue Adapter: ${market.venue.adapter}`);

    const isNegRisk = market.negRiskRequestId !== null && market.negRiskRequestId !== undefined;
    console.log(`   Is NegRisk: ${isNegRisk}\n`);

    // ===========================================
    // STEP 3: Check Current Allowances
    // ===========================================
    console.log('🔍 Step 3: Checking current allowances...\n');

    // Check USDC allowance for venue.exchange
    const usdcAllowance = await usdc.allowance(wallet.address, market.venue.exchange);
    console.log(`   USDC allowance for venue.exchange:`);
    console.log(`      ${ethers.formatUnits(usdcAllowance, 6)} USDC`);
    console.log(`      (${usdcAllowance.toString()} raw units)\n`);

    // Check CTF approval for venue.exchange
    const ctfApprovedForExchange = await ctf.isApprovedForAll(
      wallet.address,
      market.venue.exchange
    );
    console.log(`   CT approval for venue.exchange: ${ctfApprovedForExchange ? '✅ Approved' : '❌ Not approved'}`);

    // Check CTF approval for venue.adapter (NegRisk only)
    if (isNegRisk) {
      const ctfApprovedForAdapter = await ctf.isApprovedForAll(
        wallet.address,
        market.venue.adapter
      );
      console.log(
        `   CT approval for venue.adapter: ${ctfApprovedForAdapter ? '✅ Approved' : '❌ Not approved'}`
      );
    }

    console.log('');

    // ===========================================
    // STEP 4: Set Up Approvals
    // ===========================================
    console.log('🔐 Step 4: Setting up token approvals...\n');

    // 4a. Approve USDC for BUY orders
    console.log('   📝 Approving USDC for BUY orders...');
    console.log(`      Target: venue.exchange (${market.venue.exchange})`);

    if (usdcAllowance > 0) {
      console.log('      ✅ USDC already approved (allowance > 0)');
      console.log('      Skipping approval transaction\n');
    } else {
      console.log('      Approving unlimited USDC...');
      const approveTx = await usdc.approve(market.venue.exchange, ethers.MaxUint256);
      console.log(`      Transaction hash: ${approveTx.hash}`);
      console.log('      Waiting for confirmation...');

      const receipt = await approveTx.wait();
      console.log(`      ✅ USDC approved! (Block: ${receipt?.blockNumber})\n`);
    }

    // 4b. Approve CT for SELL orders
    console.log('   📝 Approving Conditional Tokens for SELL orders...');
    console.log(`      Target: venue.exchange (${market.venue.exchange})`);

    if (ctfApprovedForExchange) {
      console.log('      ✅ CT already approved for venue.exchange');
      console.log('      Skipping approval transaction\n');
    } else {
      console.log('      Approving CT for all token IDs...');
      const approvalTx = await ctf.setApprovalForAll(market.venue.exchange, true);
      console.log(`      Transaction hash: ${approvalTx.hash}`);
      console.log('      Waiting for confirmation...');

      const receipt = await approvalTx.wait();
      console.log(`      ✅ CT approved for venue.exchange! (Block: ${receipt?.blockNumber})\n`);
    }

    // 4c. Approve CT for venue.adapter (NegRisk SELL orders ONLY)
    if (isNegRisk) {
      console.log('   📝 Approving Conditional Tokens for NegRisk adapter...');
      console.log(`      Target: venue.adapter (${market.venue.adapter})`);
      console.log('      ⚠️  Required for NegRisk SELL orders!\n');

      const ctfApprovedForAdapter = await ctf.isApprovedForAll(
        wallet.address,
        market.venue.adapter
      );

      if (ctfApprovedForAdapter) {
        console.log('      ✅ CT already approved for venue.adapter');
        console.log('      Skipping approval transaction\n');
      } else {
        console.log('      Approving CT for all token IDs...');
        const approvalTx = await ctf.setApprovalForAll(market.venue.adapter, true);
        console.log(`      Transaction hash: ${approvalTx.hash}`);
        console.log('      Waiting for confirmation...');

        const receipt = await approvalTx.wait();
        console.log(`      ✅ CT approved for venue.adapter! (Block: ${receipt?.blockNumber})\n`);
      }
    }

    // ===========================================
    // STEP 5: Verify All Approvals
    // ===========================================
    console.log('✅ Step 5: Verifying all approvals...\n');

    const finalUsdcAllowance = await usdc.allowance(wallet.address, market.venue.exchange);
    const finalCtfApprovedForExchange = await ctf.isApprovedForAll(
      wallet.address,
      market.venue.exchange
    );

    console.log('   Final approval status:');
    console.log(`   ✅ USDC → venue.exchange: ${ethers.formatUnits(finalUsdcAllowance, 6)} USDC`);
    console.log(`   ✅ CT → venue.exchange: ${finalCtfApprovedForExchange ? 'Approved' : 'Not approved'}`);

    if (isNegRisk) {
      const finalCtfApprovedForAdapter = await ctf.isApprovedForAll(
        wallet.address,
        market.venue.adapter
      );
      console.log(
        `   ✅ CT → venue.adapter: ${finalCtfApprovedForAdapter ? 'Approved' : 'Not approved'}`
      );
    }

    // ===========================================
    // Summary
    // ===========================================
    console.log('\n🎉 Token approvals setup complete!\n');

    console.log('📋 What you can do now:\n');
    console.log('   BUY Orders:');
    console.log('   - Place BUY orders for YES or NO tokens');
    console.log('   - USDC will be transferred from your wallet\n');

    console.log('   SELL Orders:');
    console.log('   - Place SELL orders for YES or NO tokens you own');
    console.log('   - Conditional tokens will be transferred from your wallet');

    if (isNegRisk) {
      console.log('   - NegRisk adapter will handle token routing\n');
    } else {
      console.log('');
    }

    console.log('💡 Important Notes:');
    console.log('   - These approvals are permanent (until revoked)');
    console.log('   - You only need to run this setup ONCE per wallet');
    console.log('   - Approvals work across all markets on the same venue');
    console.log('   - Different markets may have different venues (check market.venue)');

    console.log('\n📚 Next Steps:');
    console.log('   - Run clob-gtc-order.ts to place a CLOB limit order');
    console.log('   - Run negrisk-gtc-order.ts to place a NegRisk limit order');
    console.log('   - Run clob-fok-order.ts to place a CLOB market order');
  } catch (error) {
    console.error('\n❌ Error occurred');

    if (error && typeof error === 'object' && 'code' in error) {
      const ethersError = error as { code: string; reason?: string; message: string };

      console.error('   Error code:', ethersError.code);
      console.error('   Reason:', ethersError.reason || ethersError.message);

      if (ethersError.code === 'INSUFFICIENT_FUNDS') {
        console.error(
          '\n   💡 Tip: Make sure you have enough ETH/Base tokens for gas fees'
        );
      }
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
