import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeHMACSignature } from '../../src/api/hmac';

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
        '',
      ),
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

  it('accepts market lifecycle event names on the typed websocket client', async () => {
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

    client.on('marketCreated', createdHandler).on('marketResolved', resolvedHandler);

    const connectPromise = client.connect();
    connectHandler?.();
    await connectPromise;

    expect(socketStub.on).toHaveBeenCalledWith('marketCreated', createdHandler);
    expect(socketStub.on).toHaveBeenCalledWith('marketResolved', resolvedHandler);
  });
});
