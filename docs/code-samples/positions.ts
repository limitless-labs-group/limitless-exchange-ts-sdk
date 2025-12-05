/**
 * Portfolio Positions Example
 *
 * This example demonstrates how to:
 * 1. Authenticate with the API
 * 2. Fetch user positions (CLOB and AMM)
 * 3. Calculate portfolio summary statistics
 * 4. Display position details with P&L
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import {
  HttpClient,
  MessageSigner,
  Authenticator,
  PortfolioFetcher,
  Position,
  ConsoleLogger,
} from 'limitless-exchange-ts-sdk';

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL || 'https://api.limitless.exchange';

/**
 * Format USDC amount from 6 decimals to human-readable
 */
function formatUSDC(amount: number): string {
  return (amount / 1e6).toFixed(2);
}

/**
 * Format percentage with color indicator
 */
function formatPercent(percent: number): string {
  const sign = percent >= 0 ? '+' : '';
  const emoji = percent >= 0 ? '📈' : '📉';
  return `${emoji} ${sign}${percent.toFixed(2)}%`;
}

/**
 * Display position details
 */
function displayPosition(position: Position, index: number) {
  const pnlPercent =
    position.costBasis > 0 ? (position.unrealizedPnl / position.costBasis) * 100 : 0;

  console.log(`\n${index + 1}. ${position.market.title || `Market #${position.market.id}`}`);
  console.log(`   Type: ${position.type}`);
  console.log(`   Side: ${position.side}`);
  console.log(
    `   Market Status: ${position.market.closed ? 'CLOSED' : 'OPEN'} ${position.market.status ? `(${position.market.status})` : ''}`
  );
  console.log(`   Entry Price: ${position.avgPrice.toFixed(4)}`);
  console.log(`   Current Price: ${position.currentPrice.toFixed(4)}`);
  console.log(`   Token Balance: ${formatUSDC(position.tokenBalance)} shares`);
  console.log(`   Cost Basis: $${formatUSDC(position.costBasis)}`);
  console.log(`   Market Value: $${formatUSDC(position.marketValue)}`);
  console.log(
    `   Unrealized P&L: $${formatUSDC(position.unrealizedPnl)} ${formatPercent(pnlPercent)}`
  );
  if (position.realizedPnl !== 0) {
    console.log(`   Realized P&L: $${formatUSDC(position.realizedPnl)}`);
  }
}

async function main() {
  console.log('🚀 Portfolio Positions Example\n');

  // Show configuration
  console.log('⚙️  Configuration:');
  console.log(`   API URL: ${API_URL}\n`);

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

    console.log(`   ✅ Authenticated as: ${authResult.profile.account}\n`);

    // ===========================================
    // STEP 2: Fetch Portfolio Positions
    // ===========================================
    console.log('📊 Step 2: Fetching portfolio...');

    const portfolioFetcher = new PortfolioFetcher(httpClient, logger);
    const { response, summary } = await portfolioFetcher.getPortfolio();

    console.log(`   ✅ Portfolio fetched successfully\n`);
    console.log('response ' + JSON.stringify(summary, null, 2));
    // ===========================================
    // STEP 3: Display Portfolio Summary
    // ===========================================
    console.log('='.repeat(60));
    console.log('📈 PORTFOLIO SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Value:        $${formatUSDC(summary.totalValue)}`);
    console.log(`Total Cost Basis:   $${formatUSDC(summary.totalCostBasis)}`);
    console.log(
      `Total Unrealized:   $${formatUSDC(summary.totalUnrealizedPnl)} ${formatPercent(summary.totalUnrealizedPnlPercent)}`
    );
    console.log(`Total Realized:     $${formatUSDC(summary.totalRealizedPnl)}`);
    console.log(`Open Positions:     ${summary.positionCount}`);
    console.log(`Markets:            ${summary.marketCount}`);
    console.log(`\nBreakdown:`);
    console.log(
      `  CLOB: ${summary.breakdown.clob.positions} positions, $${formatUSDC(summary.breakdown.clob.value)} value`
    );
    console.log(
      `  AMM:  ${summary.breakdown.amm.positions} positions, $${formatUSDC(summary.breakdown.amm.value)} value`
    );
    console.log(`\nPoints:`);
    console.log(`  Accumulative: ${response.accumulativePoints || '0'}`);
    console.log('='.repeat(60));

    if (summary.positionCount === 0) {
      console.log('\n   No positions found. Place some orders to see positions here!');
      console.log('\n📚 Next steps:');
      console.log('   - Place FOK order: pnpm run start:fok-order');
      console.log('   - Place GTC order: pnpm run start:gtc-order');
      return;
    }

    // ===========================================
    // STEP 4: Display Flattened Positions
    // ===========================================
    console.log('\n📋 Step 4: Position Details (Flattened View)');

    const flattenedPositions = await portfolioFetcher.getFlattenedPositions();

    // Sort by unrealized P&L (best first)
    flattenedPositions.sort((a, b) => b.unrealizedPnl - a.unrealizedPnl);

    flattenedPositions.forEach((position, index) => {
      displayPosition(position, index);
    });

    // ===========================================
    // STEP 5: CLOB vs AMM Breakdown
    // ===========================================
    console.log('\n\n📊 Step 5: CLOB vs AMM Breakdown');

    console.log(`\n💎 CLOB Positions (${response.clob.length} markets):`);
    response.clob.forEach((clobPos, index) => {
      const yesCost = parseFloat(clobPos.positions.yes.cost);
      const yesValue = parseFloat(clobPos.positions.yes.marketValue);
      const noCost = parseFloat(clobPos.positions.no.cost);
      const noValue = parseFloat(clobPos.positions.no.marketValue);

      if (yesCost > 0 || yesValue > 0 || noCost > 0 || noValue > 0) {
        console.log(`\n${index + 1}. ${clobPos.market.title}`);
        if (yesCost > 0 || yesValue > 0) {
          const yesPnl = parseFloat(clobPos.positions.yes.unrealizedPnl);
          const yesPnlPercent = yesCost > 0 ? (yesPnl / yesCost) * 100 : 0;
          console.log(`   YES: $${formatUSDC(yesValue)} ${formatPercent(yesPnlPercent)}`);
        }
        if (noCost > 0 || noValue > 0) {
          const noPnl = parseFloat(clobPos.positions.no.unrealizedPnl);
          const noPnlPercent = noCost > 0 ? (noPnl / noCost) * 100 : 0;
          console.log(`   NO:  $${formatUSDC(noValue)} ${formatPercent(noPnlPercent)}`);
        }
      }
    });

    if (response.amm.length > 0) {
      console.log(`\n🌊 AMM Positions (${response.amm.length}):`);
      response.amm.forEach((ammPos, index) => {
        const value = parseFloat(ammPos.collateralAmount);
        const pnl = parseFloat(ammPos.unrealizedPnl);
        const cost = parseFloat(ammPos.totalBuysCost);
        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

        console.log(`\n${index + 1}. ${ammPos.market.title}`);
        console.log(`   Side: ${ammPos.outcomeIndex === 0 ? 'YES' : 'NO'}`);
        console.log(`   Value: $${formatUSDC(value)} ${formatPercent(pnlPercent)}`);
      });
    }

    // ===========================================
    // STEP 6: Alternative API Usage Examples
    // ===========================================
    console.log('\n\n💡 Alternative API Usage:');
    console.log('\n1. Get raw positions:');
    console.log('   const response = await portfolioFetcher.getPositions();');
    console.log('   // Access: response.clob, response.amm, response.points');

    console.log('\n2. Get only CLOB positions:');
    console.log('   const clob = await portfolioFetcher.getCLOBPositions();');

    console.log('\n3. Get only AMM positions:');
    console.log('   const amm = await portfolioFetcher.getAMMPositions();');

    console.log('\n4. Get flattened positions:');
    console.log('   const positions = await portfolioFetcher.getFlattenedPositions();');

    console.log('\n5. Calculate summary from response:');
    console.log('   const summary = portfolioFetcher.calculateSummary(response);');

    console.log('\n🎉 Portfolio positions example completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('   - Place more orders: pnpm run start:gtc-order');
    console.log('   - View orderbook: pnpm run start:orderbook');
    console.log('   - Monitor positions by running this script periodically');
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
