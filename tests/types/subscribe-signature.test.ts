import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type {
  PositionsSubscriptionOptions,
  SubscribeArgs,
  SubscriptionChannel,
  SubscriptionOptions,
} from '../../src/types/websocket';

const ioMock = vi.fn();

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

/**
 * Compile-time contract of `WebSocketClient.subscribe()`. The `@ts-expect-error`
 * lines are enforced by `tsc -p tsconfig.test.json` (`pnpm typecheck:tests`);
 * vitest only runs the runtime assertions.
 */
describe('WebSocketClient.subscribe signature', () => {
  it('maps each channel to its trailing arguments', () => {
    expectTypeOf<SubscribeArgs<'subscribe_positions'>>().toEqualTypeOf<
      [options: PositionsSubscriptionOptions]
    >();
    expectTypeOf<SubscribeArgs<'subscribe_market_prices'>>().toEqualTypeOf<
      [options?: SubscriptionOptions]
    >();
    // Distributes over the union, so a channel-typed variable keeps the plain-options member.
    expectTypeOf<SubscribeArgs<SubscriptionChannel>>().toEqualTypeOf<
      [options: PositionsSubscriptionOptions] | [options?: SubscriptionOptions]
    >();
  });

  it('accepts a channel-typed variable, requires a market set on subscribe_positions', async () => {
    ioMock.mockReset();
    const { WebSocketClient } = await import('../../src/websocket/client');
    const client = new WebSocketClient({
      url: 'wss://ws.limitless.exchange',
      hmacCredentials: { tokenId: 'token-1', secret: Buffer.from('s').toString('base64') },
      autoReconnect: false,
    });

    // Not connected, so every call below rejects at runtime; the assertions that
    // matter are the compile-time ones, mirrored by the runtime expectations so
    // the file also fails loudly if the method ever stops throwing.
    const notConnected = 'not connected';

    // (a) a SubscriptionChannel-typed variable with plain options compiles
    const channel: SubscriptionChannel = 'subscribe_market_prices';
    const options: SubscriptionOptions = { marketSlugs: ['btc-100k-weekly'] };
    await expect(client.subscribe(channel, options)).rejects.toThrow(notConnected);
    await expect(client.subscribe(channel)).rejects.toThrow(notConnected);

    // (b) subscribe_positions without a payload does not compile
    // @ts-expect-error subscribe_positions must carry marketSlugs and/or marketAddresses
    await expect(client.subscribe('subscribe_positions')).rejects.toThrow(notConnected);

    // The deprecated singular keys are ignored by the server, so they do not satisfy it either
    // @ts-expect-error marketSlug (singular) is not a market set
    await expect(client.subscribe('subscribe_positions', { marketSlug: 'x' })).rejects.toThrow(
      notConnected
    );

    // (c) subscribe_positions with a market set compiles, by slug or by address
    await expect(
      client.subscribe('subscribe_positions', { marketSlugs: ['btc-100k-weekly'] })
    ).rejects.toThrow(notConnected);
    await expect(
      client.subscribe('subscribe_positions', {
        marketAddresses: ['0x1234000000000000000000000000000000000000'],
      })
    ).rejects.toThrow(notConnected);

    // Other channels keep their optional options
    await expect(client.subscribe('subscribe_order_events')).rejects.toThrow(notConnected);
    await expect(
      client.subscribe('subscribe_market_prices', { marketSlugs: ['btc-100k-weekly'] })
    ).rejects.toThrow(notConnected);
  });
});
