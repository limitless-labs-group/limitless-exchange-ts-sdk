import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeHMACSignature } from '../../src/api/hmac';

const ioMock = vi.fn();

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

describe('WebSocketClient handshake re-signing on reconnect', () => {
  let connectHandler: (() => void) | undefined;
  let reconnectAttemptHandler: ((attempt: number) => void) | undefined;

  beforeEach(() => {
    connectHandler = undefined;
    reconnectAttemptHandler = undefined;
    ioMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('signs fresh HMAC headers before every reconnect attempt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));

    const socketStub: any = {
      connected: false,
      once: vi.fn((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connect') connectHandler = handler as () => void;
      }),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      timeout: vi.fn(() => ({ emitWithAck: vi.fn() })),
      io: {
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (event === 'reconnect_attempt') reconnectAttemptHandler = handler as (attempt: number) => void;
        }),
        // Socket.IO replays these options on every automatic reconnect.
        opts: {} as Record<string, unknown>,
      },
    };
    ioMock.mockReturnValue(socketStub);

    const { WebSocketClient } = await import('../../src/websocket/client');
    const secret = Buffer.from('ws-secret').toString('base64');
    const client = new WebSocketClient({
      url: 'wss://ws.limitless.exchange',
      hmacCredentials: { tokenId: 'token-1', secret },
      autoReconnect: true,
    });

    const connectPromise = client.connect();
    const [, options] = ioMock.mock.calls[0];
    const first = options.extraHeaders;
    expect(first['lmts-timestamp']).toBe('2026-09-24T12:00:00.000Z');
    connectHandler?.();
    await connectPromise;
    expect(reconnectAttemptHandler).toBeDefined();

    // The server rejects a handshake timestamp older than 30 seconds. A reconnect
    // a minute later must not reuse the headers signed at the first connect.
    vi.setSystemTime(new Date('2026-09-24T12:01:00.000Z'));
    reconnectAttemptHandler?.(1);

    const resigned = socketStub.io.opts.extraHeaders as Record<string, string>;
    expect(resigned).toBeDefined();
    expect(resigned['lmts-api-key']).toBe('token-1');
    expect(resigned['lmts-timestamp']).toBe('2026-09-24T12:01:00.000Z');
    expect(resigned['lmts-timestamp']).not.toBe(first['lmts-timestamp']);
    expect(resigned['lmts-signature']).toBe(
      computeHMACSignature(secret, resigned['lmts-timestamp'], 'GET', '/socket.io/?EIO=4&transport=websocket', '')
    );
    expect(resigned['lmts-signature']).not.toBe(first['lmts-signature']);
    expect(resigned['x-sdk-version']).toMatch(/^lmts-sdk-ts\//);
  });

  it('leaves the options untouched when no credentials are configured', async () => {
    const socketStub: any = {
      connected: false,
      once: vi.fn((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connect') connectHandler = handler as () => void;
      }),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      timeout: vi.fn(() => ({ emitWithAck: vi.fn() })),
      io: {
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (event === 'reconnect_attempt') reconnectAttemptHandler = handler as (attempt: number) => void;
        }),
        opts: {} as Record<string, unknown>,
      },
    };
    ioMock.mockReturnValue(socketStub);

    const { WebSocketClient } = await import('../../src/websocket/client');
    const client = new WebSocketClient({ url: 'wss://ws.limitless.exchange', autoReconnect: true });
    const connectPromise = client.connect();
    connectHandler?.();
    await connectPromise;

    reconnectAttemptHandler?.(1);
    // Tracking headers only: no lmts-* keys were ever set, and none appear now.
    const headers = (socketStub.io.opts.extraHeaders ?? {}) as Record<string, string>;
    expect(Object.keys(headers).some((k) => k.startsWith('lmts-'))).toBe(false);
  });
});
