/**
 * WebSocket Event Debugging
 *
 * This script connects to the WebSocket and logs all subscription responses
 * and events for debugging purposes.
 */

import { config } from 'dotenv';
import { WebSocketClient, OrderEvent } from '@limitless-exchange/sdk';

config();

const WS_URL = process.env.WS_URL || 'wss://ws.limitless.exchange';
const MARKET_SLUG = process.env.EXAMPLE_MARKET_SLUG || '';

async function main() {
  console.log('🔍 WebSocket Event Debugger\n');

  // Check for API key (required for authenticated subscriptions)
  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Please set LIMITLESS_API_KEY in .env file\n' +
        'Get your API key from: https://limitless.exchange'
    );
  }

  try {
    // Initialize WebSocket client with API key
    const wsClient = new WebSocketClient({
      url: WS_URL,
      apiKey,
      autoReconnect: true,
    });

    // Set up event listeners to log ALL events
    wsClient.on('connect', () => {
      console.log('✅ Connected!\n');
    });

    wsClient.on('disconnect', (reason: string) => {
      console.log(`\n⚠️  Disconnected: ${reason}`);
    });

    wsClient.on('error', (error: Error) => {
      console.error('\n❌ Socket error:', error);
    });

    wsClient.on('reconnecting', (attempt: number) => {
      console.log(`🔄 Reconnecting... (attempt ${attempt})`);
    });

    // Log market price updates
    wsClient.on('newPriceData', (data) => {
      console.log('\n📊 AMM Price Update:', JSON.stringify(data, null, 2));
    });

    // Log orderbook updates
    wsClient.on('orderbookUpdate', (data) => {
      console.log('\n📖 Orderbook Update:', JSON.stringify(data, null, 2));
    });

    // Log position updates (requires API key)
    wsClient.on('positions', (data) => {
      console.log('\n📋 Position Update:', JSON.stringify(data, null, 2));
    });

    // Log transaction events (requires API key)
    // TransactionEvent contains: userId, txHash, status, source, timestamp, marketAddress, marketSlug, tokenId
    wsClient.on('tx', (data) => {
      console.log('\n🎯 Transaction Event:', JSON.stringify(data, null, 2));
    });

    // Log order events (requires API key) — discriminate on source + type
    wsClient.on('orderEvent', (data: OrderEvent) => {
      if (data.source === 'OME' && data.type === 'EXECUTION') {
        // FAK/FOK terminal frame: status is FILLED | PARTIALLY_FILLED | KILLED
        console.log(`\n⚡ Order EXECUTION (${data.status}):`, JSON.stringify(data, null, 2));
      } else if (data.source === 'SETTLEMENT' && data.type === 'MATCHED') {
        // Pre-settlement per-fill frame: isEstimate is true, fee fields are estimates
        console.log(`\n🤝 Order MATCHED (isEstimate=${data.isEstimate}):`, JSON.stringify(data, null, 2));
      } else {
        console.log('\n📨 Order Event:', JSON.stringify(data, null, 2));
      }
    });

    // Connect to WebSocket
    console.log('🔌 Connecting to WebSocket...');
    console.log(`   URL: ${WS_URL}\n`);
    await wsClient.connect();

    // Subscribe to market prices (public - no API key required)
    console.log('📡 Subscribing to market prices...\n');
    await wsClient.subscribe('subscribe_market_prices', {
      marketSlugs: [MARKET_SLUG],
    });
    console.log('✅ Subscribed to market prices\n');

    // Subscribe to positions (requires API key)
    console.log('📡 Subscribing to positions...\n');
    await wsClient.subscribe('subscribe_positions', {
      marketSlugs: [MARKET_SLUG],
    });
    console.log('✅ Subscribed to positions\n');

    // Subscribe to transactions (requires API key)
    console.log('📡 Subscribing to transactions...\n');
    await wsClient.subscribe('subscribe_transactions', {});
    console.log('✅ Subscribed to transactions\n');

    // Subscribe to order events (requires API key)
    console.log('📡 Subscribing to order events...\n');
    await wsClient.subscribe('subscribe_order_events', {});
    console.log('✅ Subscribed to order events\n');

    console.log('\n✅ All subscriptions active. Waiting for events...\n');
    console.log('💡 Now create/cancel orders to see events appear\n');

    // Keep alive
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n\n👋 Exiting...');
  process.exit(0);
});

main();
