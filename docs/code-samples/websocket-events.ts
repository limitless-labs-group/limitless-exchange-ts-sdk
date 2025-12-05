/**
 * WebSocket Event Debugging
 *
 * This script connects to the WebSocket and logs subscription responses
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator, ConsoleLogger } from '@limitless-exchange/sdk';

config();

const API_URL = process.env.API_URL || 'https://api.limitless.exchange';
const WS_URL = process.env.WS_URL || 'wss://ws.limitless.exchange';
const MARKET_SLUG = process.env.EXAMPLE_MARKET_SLUG || '';

async function main() {
  console.log('🔍 WebSocket Event Debugger\n');

  try {
    // Authenticate
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
    const httpClient = new HttpClient({ baseURL: API_URL });
    const signer = new MessageSigner(wallet);
    const authenticator = new Authenticator(httpClient, signer);

    const { sessionCookie } = await authenticator.authenticate({ client: 'eoa' });
    console.log('✅ Authenticated\n');
    console.log('Session Cookie:', sessionCookie.substring(0, 50) + '...\n');

    // Import socket.io-client dynamically from SDK's dependencies
    const { io } = await import('socket.io-client');

    console.log('🔌 Connecting to WebSocket...');
    console.log(`   URL: ${WS_URL}/markets\n`);

    // Connect to the /markets namespace
    // Pass session cookie as HTTP cookie header (required for authentication)
    const socket = io(`${WS_URL}/markets`, {
      transports: ['websocket'],
      extraHeaders: {
        cookie: `limitless_session=${sessionCookie}`,
      },
    });

    // Log ALL events using onAny
    socket.onAny((eventName: string, ...args: any[]) => {
      console.log(`\n📨 Event: "${eventName}"`);
      console.log(JSON.stringify(args, null, 2));
    });

    socket.on('connect', () => {
      console.log('✅ Connected!\n');
      console.log('📡 Subscribing to channels...\n');

      // Subscribe to market prices and orderbook
      socket.emit(
        'subscribe_market_prices',
        {
          marketSlugs: [MARKET_SLUG],
        },
        (response: any) => {
          console.log('📊 Market prices subscription response:', response);
        }
      );

      // Subscribe to positions (requires auth)
      socket.emit(
        'subscribe_positions',
        {
          marketSlugs: [MARKET_SLUG],
        },
        (response: any) => {
          console.log('📋 Positions subscription response:', response);
        }
      );

      // Subscribe to transactions (requires auth)
      socket.emit('subscribe_transactions', {}, (response: any) => {
        console.log('🎯 Transactions subscription response:', response);
      });

      console.log('\n✅ Subscription requests sent. Waiting for events...\n');
      console.log('💡 Now create/cancel orders to see events appear\n');
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`\n⚠️  Disconnected: ${reason}`);
    });

    socket.on('connect_error', (error: Error) => {
      console.error('\n❌ Connection error:', error.message);
    });

    socket.on('error', (error: Error) => {
      console.error('\n❌ Socket error:', error);
    });

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
