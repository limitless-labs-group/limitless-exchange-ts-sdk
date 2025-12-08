/**
 * Orderbook Viewing Example
 *
 * This example demonstrates how to:
 * 1. Fetch and display orderbook data
 * 2. Analyze bid/ask spreads
 * 3. View market depth
 * 4. Monitor orderbook in real-time (polling)
 */

import { config } from 'dotenv';
import { HttpClient, MarketFetcher, OrderBook, ConsoleLogger } from '@limitless-exchange/sdk';

// Load environment variables
config();

// Configuration constants
const API_URL = process.env.API_URL || 'https://api.limitless.exchange';

/**
 * Format orderbook entry for display
 */
function formatOrderbookEntry(entry: any, index: number): string {
  return `   ${index + 1}. Price: ${entry.price.toFixed(4)} | Size: ${(entry.size / 1000000).toFixed(2)} shares`;
}

/**
 * Calculate and display orderbook statistics
 */
function displayOrderbookStats(orderbook: OrderBook) {
  console.log('\n📊 Orderbook Statistics:');

  if (orderbook.bids.length > 0 && orderbook.asks.length > 0) {
    const bestBid = orderbook.bids[0].price;
    const bestAsk = orderbook.asks[0].price;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;

    console.log(`   Best Bid: ${bestBid.toFixed(4)}`);
    console.log(`   Best Ask: ${bestAsk.toFixed(4)}`);
    console.log(`   Spread: ${spread.toFixed(4)} (${(spread * 100).toFixed(2)}%)`);
    console.log(`   Mid Price: ${midPrice.toFixed(4)}`);
    console.log(`   Adjusted Midpoint: ${orderbook.adjustedMidpoint.toFixed(4)}`);
  } else {
    console.log(`   No complete bid/ask spread available`);
  }

  // Total volumes
  const totalBidVolume = orderbook.bids.reduce((sum, bid) => sum + bid.size, 0) / 1000000;
  const totalAskVolume = orderbook.asks.reduce((sum, ask) => sum + ask.size, 0) / 1000000;

  console.log(`   Total Bid Volume: ${totalBidVolume.toFixed(2)} shares`);
  console.log(`   Total Ask Volume: ${totalAskVolume.toFixed(2)} shares`);
  console.log(`   Min Order Size: ${orderbook.minSize}`);
  console.log(`   Max Spread: ${orderbook.maxSpread}`);
  console.log(`   Last Trade Price: ${orderbook.lastTradePrice.toFixed(4)}`);
}

async function fetchAndDisplayOrderbook(
  marketFetcher: MarketFetcher,
  marketSlug: string,
  showTopN: number = 10
) {
  console.log(`\n🔍 Fetching orderbook for: ${marketSlug}...`);

  const orderbook = await marketFetcher.getOrderBook(marketSlug);

  console.log(`\n📋 Full Orderbook Response:`);
  console.log(JSON.stringify(orderbook, null, 2));

  console.log(`\n📗 Token ID (YES): ${orderbook.tokenId}`);
  console.log(`\n📈 BUY Orders (Bids): ${orderbook.bids.length} total`);

  if (orderbook.bids.length > 0) {
    const displayBids = orderbook.bids.slice(0, showTopN);
    displayBids.forEach((bid, index) => {
      console.log(formatOrderbookEntry(bid, index));
    });
    if (orderbook.bids.length > showTopN) {
      console.log(`   ... and ${orderbook.bids.length - showTopN} more`);
    }
  } else {
    console.log(`   No bids available`);
  }

  console.log(`\n📉 SELL Orders (Asks): ${orderbook.asks.length} total`);

  if (orderbook.asks.length > 0) {
    const displayAsks = orderbook.asks.slice(0, showTopN);
    displayAsks.forEach((ask, index) => {
      console.log(formatOrderbookEntry(ask, index));
    });
    if (orderbook.asks.length > showTopN) {
      console.log(`   ... and ${orderbook.asks.length - showTopN} more`);
    }
  } else {
    console.log(`   No asks available`);
  }

  displayOrderbookStats(orderbook);

  return orderbook;
}

async function main() {
  console.log('🚀 Orderbook Viewing Example\n');

  const logger = new ConsoleLogger('info');

  try {
    // ===========================================
    // STEP 1: Initialize HTTP Client
    // ===========================================
    console.log('🌐 Step 1: Initializing HTTP client...');

    // Note: No authentication needed - orderbook, markets, and prices are public endpoints
    const httpClient = new HttpClient({
      baseURL: API_URL,
      timeout: 30000,
    });
    console.log(`   API URL: ${API_URL}\n`);

    // ===========================================
    // STEP 2: Initialize Market Fetcher
    // ===========================================
    console.log('📦 Step 2: Initializing market fetcher...');
    const marketFetcher = new MarketFetcher(httpClient, logger);
    console.log(`   Market fetcher ready\n`);

    // ===========================================
    // STEP 3: Fetch Markets List (Optional - commented out)
    // ===========================================
    // Note: /markets endpoint may not be available in all API versions
    // console.log("📋 Step 3: Fetching available markets...");
    // const markets = await marketFetcher.getMarkets();
    // console.log(`   Found ${markets.length} markets`);

    // // Display first 5 markets
    // console.log(`\n   Top 5 Markets:`);
    // markets.slice(0, 5).forEach((market, index) => {
    //   console.log(`   ${index + 1}. ${market.title}`);
    //   console.log(`      Slug: ${market.slug}`);
    //   console.log(`      Type: ${market.type || "N/A"}`);
    // });

    // ===========================================
    // STEP 4: Fetch Single Market Orderbook
    // ===========================================
    const marketSlug =
      process.env.MARKET_SLUG || 'dollaraapl-above-dollar27883-on-dec-5-2100-utc-1764360008700';

    await fetchAndDisplayOrderbook(marketFetcher, marketSlug, 10);

    // ===========================================
    // STEP 5: Monitor Orderbook (Optional)
    // ===========================================
    const shouldMonitor = process.env.MONITOR_ORDERBOOK === 'true';

    if (shouldMonitor) {
      console.log(`\n\n🔄 Step 5: Monitoring orderbook (polling every 10s)...`);
      console.log(`   Press Ctrl+C to stop\n`);

      let iteration = 1;
      const monitorInterval = setInterval(async () => {
        try {
          console.log(`\n${'='.repeat(60)}`);
          console.log(`Refresh #${iteration} - ${new Date().toISOString()}`);
          console.log('='.repeat(60));

          await fetchAndDisplayOrderbook(marketFetcher, marketSlug, 5);

          iteration++;
        } catch (error) {
          console.error('   ⚠️  Error fetching orderbook:', error);
        }
      }, 10000);

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n\n👋 Stopping orderbook monitor...');
        clearInterval(monitorInterval);
        process.exit(0);
      });
    } else {
      console.log(`\n\n💡 Tip: Set MONITOR_ORDERBOOK=true to enable real-time monitoring`);
      console.log('🎉 Orderbook example completed successfully!');
      console.log('\n📚 Next steps:');
      console.log('   - Place FOK order: pnpm run start:fok-order');
      console.log('   - Place GTC order: pnpm run start:gtc-order');
      console.log('   - View trading example: pnpm run start:trading');
    }
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
  .then(() => {
    if (process.env.MONITOR_ORDERBOOK !== 'true') {
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
