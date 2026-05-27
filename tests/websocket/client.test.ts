import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeHMACSignature } from '../../src/api/hmac';
import { WebSocketState } from '../../src/types/websocket';
import type { SubscriptionChannel } from '../../src/types/websocket';

const ioMock = vi.fn();

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

describe('WebSocketClient HMAC auth', () => {
  let connectHandler: (() => void) | undefined;

  beforeEach(() => {
    connectHandler = undefined;
    ioMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes HMAC auth headers during websocket connect', async () => {
    vi.useFakeTimers();

    const socketStub: any = {
      connected: false,
      once: vi.fn((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connect') {
          connectHandler = handler as () => void;
        }
      }),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      timeout: vi.fn(() => ({ emitWithAck: vi.fn() })),
      io: {
        on: vi.fn(),
      },
    };

    ioMock.mockReturnValue(socketStub);

    const { WebSocketClient } = await import('../../src/websocket/client');
    const secret = Buffer.from('ws-secret').toString('base64');
    const client = new WebSocketClient({
      url: 'wss://ws.limitless.exchange',
      hmacCredentials: {
        tokenId: 'token-1',
        secret,
      },
      autoReconnect: false,
    });

    const connectPromise = client.connect();

    expect(ioMock).toHaveBeenCalledTimes(1);
    const [url, options] = ioMock.mock.calls[0];
    expect(url).toBe('wss://ws.limitless.exchange/markets');
    expect(options.extraHeaders['x-sdk-version']).toMatch(/^lmts-sdk-ts\//);
    expect(options.extraHeaders['user-agent']).toContain('lmts-sdk-ts/');
    expect(options.extraHeaders['user-agent']).toContain('(node/');
    expect(options.extraHeaders['lmts-api-key']).toBe('token-1');
    expect(options.extraHeaders['lmts-signature']).toBe(
      computeHMACSignature(
        secret,
        options.extraHeaders['lmts-timestamp'],
        'GET',
        '/socket.io/?EIO=4&transport=websocket',
        ''
      )
    );

    connectHandler?.();
    await connectPromise;
  });

  it('passes sdk tracking headers during websocket connect without auth', async () => {
    vi.useFakeTimers();

    const socketStub: any = {
      connected: false,
      once: vi.fn((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connect') {
          connectHandler = handler as () => void;
        }
      }),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      timeout: vi.fn(() => ({ emitWithAck: vi.fn() })),
      io: {
        on: vi.fn(),
      },
    };

    ioMock.mockReturnValue(socketStub);

    const { WebSocketClient } = await import('../../src/websocket/client');
    const client = new WebSocketClient({
      url: 'wss://ws.limitless.exchange',
      autoReconnect: false,
    });

    const connectPromise = client.connect();

    expect(ioMock).toHaveBeenCalledTimes(1);
    const [url, options] = ioMock.mock.calls[0];
    expect(url).toBe('wss://ws.limitless.exchange/markets');
    expect(options.extraHeaders['x-sdk-version']).toMatch(/^lmts-sdk-ts\//);
    expect(options.extraHeaders['user-agent']).toContain('lmts-sdk-ts/');
    expect(options.extraHeaders['user-agent']).toContain('(node/');

    connectHandler?.();
    await connectPromise;
  });

  it('accepts server websocket event names on the typed websocket client', async () => {
    vi.useFakeTimers();

    const socketStub: any = {
      connected: false,
      once: vi.fn((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connect') {
          connectHandler = handler as () => void;
        }
      }),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      timeout: vi.fn(() => ({ emitWithAck: vi.fn() })),
      io: {
        on: vi.fn(),
      },
    };

    ioMock.mockReturnValue(socketStub);

    const { WebSocketClient } = await import('../../src/websocket/client');
    const client = new WebSocketClient({
      url: 'wss://ws.limitless.exchange',
      autoReconnect: false,
    });

    const createdHandler = vi.fn();
    const resolvedHandler = vi.fn();
    const orderEventHandler = vi.fn();
    const oraclePriceHandler = vi.fn();
    const liveSportsHandler = vi.fn();
    const liveEsportsHandler = vi.fn();
    const systemHandler = vi.fn();
    const serverChannels: SubscriptionChannel[] = [
      'subscribe_order_events',
      'subscribe_live_sports',
      'subscribe_live_esports',
      'subscribe_market_lifecycle',
      'unsubscribe_market_lifecycle',
    ];

    client
      .on('marketCreated', createdHandler)
      .on('marketResolved', resolvedHandler)
      .on('orderEvent', orderEventHandler)
      .on('oraclePriceData', oraclePriceHandler)
      .on('live_sports_update', liveSportsHandler)
      .on('live_esports_update', liveEsportsHandler)
      .on('system', systemHandler);

    expect(serverChannels).toHaveLength(5);

    const connectPromise = client.connect();
    connectHandler?.();
    await connectPromise;

    expect(socketStub.on).toHaveBeenCalledWith('marketCreated', createdHandler);
    expect(socketStub.on).toHaveBeenCalledWith('marketResolved', resolvedHandler);
    expect(socketStub.on).toHaveBeenCalledWith('orderEvent', orderEventHandler);
    expect(socketStub.on).toHaveBeenCalledWith('oraclePriceData', oraclePriceHandler);
    expect(socketStub.on).toHaveBeenCalledWith('live_sports_update', liveSportsHandler);
    expect(socketStub.on).toHaveBeenCalledWith('live_esports_update', liveEsportsHandler);
    expect(socketStub.on).toHaveBeenCalledWith('system', systemHandler);
  });

  it('rejects unsupported websocket subscription channels at runtime', async () => {
    const { WebSocketClient } = await import('../../src/websocket/client');
    const client = new WebSocketClient({
      url: 'wss://ws.limitless.exchange',
      autoReconnect: false,
    });

    (client as any).state = WebSocketState.CONNECTED;
    (client as any).socket = {
      connected: true,
      emit: vi.fn(),
      timeout: vi.fn(() => ({ emitWithAck: vi.fn() })),
    };

    await expect(client.subscribe('trades' as SubscriptionChannel, {})).rejects.toThrow(
      'Unsupported websocket subscription channel "trades"'
    );
  });
});
