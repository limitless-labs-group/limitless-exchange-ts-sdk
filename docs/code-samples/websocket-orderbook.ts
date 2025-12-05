/**
 * WebSocket Orderbook Monitor Example
 *
 * This example demonstrates real-time orderbook monitoring:
 * 1. Connect to WebSocket (no authentication needed for public data)
 * 2. Subscribe to orderbook updates for a specific market
 * 3. Display real-time price changes
 * 4. Calculate spread and market depth
 */

import { config } from 'dotenv';
import {
  WebSocketClient,
  HttpClient,
  MarketFetcher,
  ConsoleLogger,
} from 'limitless-exchange-ts-sdk';

// Load environment variables
config();

// Configuration
const API_URL = process.env.API_URL || 'https://api.limitless.exchange';
const WS_URL = process.env.WS_URL || 'wss://ws.limitless.exchange';
const MARKET_SLUG =
  process.env.EXAMPLE_MARKET_SLUG ||
  'dollarbtc-above-dollar9160011-on-dec-5-1000-utc-1764842436957';

// Track orderbook state
interface OrderbookState {
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPercent: number;
  bidDepth: number;
  askDepth: number;
  lastUpdate: Date;
}

let currentState: OrderbookState | null = null;

function formatPrice(price: number): string {
  return `${(price * 100).toFixed(1)}%`;
}

function formatSpread(spread: number): string {
  return `${(spread * 100).toFixed(2)}%`;
}

function displayOrderbook(state: OrderbookState, orderbook?: any) {
  console.clear();
  console.log('='.repeat(60));
  console.log(`📊 Real-Time Orderbook Monitor: ${MARKET_SLUG}`);
  console.log('='.repeat(60));
  console.log(`Last Update: ${state.lastUpdate.toLocaleTimeString()}\n`);

  console.log('📈 Market Depth:');
  console.log(`   Best Bid: ${formatPrice(state.bestBid)} (${state.bidDepth.toFixed(2)} shares)`);
  console.log(`   Best Ask: ${formatPrice(state.bestAsk)} (${state.askDepth.toFixed(2)} shares)`);
  console.log(
    `   Spread:   ${formatSpread(state.spread)} (${formatSpread(state.spreadPercent)})\n`
  );

  const midPrice = (state.bestBid + state.bestAsk) / 2;
  console.log(`💎 Mid Price: ${formatPrice(midPrice)}\n`);

  // Show top 5 bids and asks
  if (orderbook) {
    console.log('📋 Top Bids:');
    const topBids = orderbook.bids.slice(0, 5);
    topBids.forEach((bid: any, i: number) => {
      console.log(`   ${i + 1}. ${formatPrice(bid.price)} - ${bid.size.toFixed(2)} shares`);
    });

    console.log('\n📋 Top Asks:');
    const topAsks = orderbook.asks.slice(0, 5);
    topAsks.forEach((ask: any, i: number) => {
      console.log(`   ${i + 1}. ${formatPrice(ask.price)} - ${ask.size.toFixed(2)} shares`);
    });
    console.log('');
  }

  console.log('📊 Market Status:');
  if (state.spread < 0.01) {
    console.log('   🟢 Tight spread - Good liquidity');
  } else if (state.spread < 0.05) {
    console.log('   🟡 Moderate spread - Fair liquidity');
  } else {
    console.log('   🔴 Wide spread - Low liquidity');
  }

  console.log('\n💡 Press Ctrl+C to stop monitoring');
  console.log('='.repeat(60));
}

async function main() {
  console.log('🚀 WebSocket Orderbook Monitor\n');

  const logger = new ConsoleLogger('info');

  try {
    // ===========================================
    // STEP 1: Fetch Initial Orderbook
    // ===========================================
    console.log('📖 Fetching initial orderbook...');

    const httpClient = new HttpClient({
      baseURL: API_URL,
      timeout: 30000,
    });

    const marketFetcher = new MarketFetcher(httpClient);
    const orderbook = await marketFetcher.getOrderBook(MARKET_SLUG);

    if (orderbook.bids.length === 0 || orderbook.asks.length === 0) {
      console.log('   ⚠️  No orders on orderbook. Try a different market.');
      return;
    }

    // Initialize state
    currentState = {
      bestBid: orderbook.bids[0].price,
      bestAsk: orderbook.asks[0].price,
      spread: orderbook.asks[0].price - orderbook.bids[0].price,
      spreadPercent:
        ((orderbook.asks[0].price - orderbook.bids[0].price) / orderbook.bids[0].price) * 100,
      bidDepth: orderbook.bids[0].size,
      askDepth: orderbook.asks[0].size,
      lastUpdate: new Date(),
    };

    displayOrderbook(currentState);

    // ===========================================
    // STEP 2: Connect to WebSocket
    // ===========================================
    console.log('\n🔌 Connecting to WebSocket...');

    const wsClient = new WebSocketClient({
      url: WS_URL,
      autoReconnect: true,
    }); // No logger = no SDK logs, completely silent

    // Setup event handlers
    wsClient.on('connect', () => {
      console.log('✅ WebSocket connected\n');
    });

    wsClient.on('disconnect', (reason) => {
      console.log(`\n⚠️  Disconnected: ${reason}`);
    });

    wsClient.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });

    // Log ALL events for debugging (like test-websocket-events)
    (wsClient as any).socket?.onAny?.((eventName: string, ...args: any[]) => {
      console.log(`\n📨 Raw Event: "${eventName}"`);
      console.log(JSON.stringify(args, null, 2));
    });

    // Subscribe to orderbook updates using the actual API event name
    wsClient.on('orderbookUpdate' as any, (data: any) => {
      console.log('\n🔔 Processing orderbookUpdate event...');

      // API sends { marketSlug, orderbook: { bids, asks }, timestamp }
      const orderbook = data.orderbook || data;

      if (
        !orderbook.bids ||
        !orderbook.asks ||
        orderbook.bids.length === 0 ||
        orderbook.asks.length === 0
      ) {
        console.log('⚠️  No bids/asks in orderbook');
        return;
      }

      const bestBid = orderbook.bids[0].price;
      const bestAsk = orderbook.asks[0].price;
      const spread = bestAsk - bestBid;

      currentState = {
        bestBid,
        bestAsk,
        spread,
        spreadPercent: (spread / bestBid) * 100,
        bidDepth: orderbook.bids[0].size,
        askDepth: orderbook.asks[0].size,
        lastUpdate: new Date(data.timestamp || Date.now()),
      };

      displayOrderbook(currentState, orderbook);
    });

    // Connect
    await wsClient.connect();

    // Subscribe to market using raw API event name and format
    await wsClient.subscribe('subscribe_market_prices', { marketSlugs: [MARKET_SLUG] });
    console.log(`✅ Subscribed to: ${MARKET_SLUG}\n`);

    // ===========================================
    // STEP 3: Monitor Updates
    // ===========================================
    console.log('👀 Monitoring real-time updates...\n');

    // Keep running until Ctrl+C
    await new Promise(() => {});
  } catch (error) {
    console.error('\n❌ Error occurred');

    if (error instanceof Error) {
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

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping orderbook monitor...');
  process.exit(0);
});

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
