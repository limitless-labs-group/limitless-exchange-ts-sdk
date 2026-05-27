import { describe, expect, it, vi } from 'vitest';
import { OrderClient } from '../../src/orders/client';
import { OrderType, Side } from '../../src/types/orders';

describe('OrderClient', () => {
  function buildCreateOrderHarness() {
    const walletAddress = '0x0000000000000000000000000000000000000001';
    const signature = `0x${'a'.repeat(130)}`;
    const httpClient = {
      post: vi.fn().mockImplementation(async (_path: string, payload: any) => ({
        order: {
          id: 'order-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          makerAmount: payload.order.makerAmount,
          takerAmount: payload.order.takerAmount,
          expiration: payload.order.expiration,
          signatureType: payload.order.signatureType,
          salt: payload.order.salt,
          maker: payload.order.maker,
          signer: payload.order.signer,
          taker: payload.order.taker,
          tokenId: payload.order.tokenId,
          side: payload.order.side,
          feeRateBps: payload.order.feeRateBps,
          nonce: payload.order.nonce,
          signature: payload.order.signature,
          orderType: payload.orderType,
          price: payload.order.price,
          marketId: 42,
        },
        makerMatches: [],
      })),
    } as any;

    const client = new OrderClient({
      httpClient,
      wallet: {
        address: walletAddress,
      } as any,
    });

    (client as any).cachedUserData = {
      userId: 42,
      feeRateBps: 300,
    };
    (client as any).orderBuilder = {
      buildOrder: vi.fn().mockReturnValue({
        salt: 123,
        maker: walletAddress,
        signer: walletAddress,
        taker: '0x0000000000000000000000000000000000000000',
        tokenId: '123',
        makerAmount: 5500000,
        takerAmount: 10000000,
        expiration: '0',
        nonce: 0,
        feeRateBps: 300,
        side: Side.BUY,
        signatureType: 0,
        price: 0.55,
      }),
    };
    (client as any).orderSigner = {
      signOrder: vi.fn().mockResolvedValue(signature),
    };
    (client as any).marketFetcher = {
      getVenue: vi.fn().mockReturnValue({
        exchange: '0x0000000000000000000000000000000000000002',
        adapter: null,
      }),
    };

    return { client, httpClient };
  }

  it('normalizes numeric-string createOrder fields for makerAmount, takerAmount, price, and safe salt', () => {
    const client = new OrderClient({
      httpClient: {} as any,
      wallet: {
        address: '0x0000000000000000000000000000000000000001',
      } as any,
    });

    const transformed = (client as any).transformOrderResponse({
      order: {
        id: 'order-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        makerAmount: '50',
        takerAmount: '100',
        expiration: '0',
        signatureType: '0',
        salt: '1742000000000000',
        maker: '0x0000000000000000000000000000000000000001',
        signer: '0x0000000000000000000000000000000000000001',
        taker: '0x0000000000000000000000000000000000000000',
        tokenId: '123',
        side: '0',
        feeRateBps: '300',
        nonce: '0',
        signature: '0xabc',
        orderType: 'GTC',
        price: '0.52',
        marketId: '42',
      },
    });

    expect(transformed.order.makerAmount).toBe(50);
    expect(transformed.order.takerAmount).toBe(100);
    expect(transformed.order.price).toBe(0.52);
    expect(transformed.order.salt).toBe(1742000000000000);

    // Out of scope: non-payload fields are passed through unchanged.
    expect(transformed.order.marketId).toBe('42');
  });

  it('preserves salt as string when integer is outside IEEE-754 safe range', () => {
    const client = new OrderClient({
      httpClient: {} as any,
      wallet: {
        address: '0x0000000000000000000000000000000000000001',
      } as any,
    });

    const transformed = (client as any).transformOrderResponse({
      order: {
        id: 'order-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        makerAmount: '50',
        takerAmount: '100',
        expiration: '0',
        signatureType: '0',
        salt: '9007199254740993',
        maker: '0x0000000000000000000000000000000000000001',
        signer: '0x0000000000000000000000000000000000000001',
        taker: '0x0000000000000000000000000000000000000000',
        tokenId: '123',
        side: '0',
        feeRateBps: '300',
        nonce: '0',
        signature: '0xabc',
        orderType: 'GTC',
        price: '0.52',
        marketId: '42',
      },
    });

    expect(transformed.order.salt).toBe('9007199254740993');
  });

  it('preserves null createdAt on makerMatches', () => {
    const client = new OrderClient({
      httpClient: {} as any,
      wallet: {
        address: '0x0000000000000000000000000000000000000001',
      } as any,
    });

    const transformed = (client as any).transformOrderResponse({
      order: {
        id: 'order-3',
        createdAt: '2026-01-01T00:00:00.000Z',
        makerAmount: '50',
        takerAmount: '100',
        expiration: '0',
        signatureType: '0',
        salt: '1742000000000000',
        maker: '0x0000000000000000000000000000000000000001',
        signer: '0x0000000000000000000000000000000000000001',
        taker: '0x0000000000000000000000000000000000000000',
        tokenId: '123',
        side: '0',
        feeRateBps: '300',
        nonce: '0',
        signature: '0xabc',
        orderType: 'FOK',
        price: null,
        marketId: '42',
      },
      makerMatches: [
        {
          id: 'match-1',
          createdAt: null,
          matchedSize: '1000000',
          orderId: '2c92ce01-e59b-4966-9d3f-a03bdb85e3eb',
        },
      ],
    });

    expect(transformed.makerMatches).toEqual([
      {
        id: 'match-1',
        createdAt: null,
        matchedSize: '1000000',
        orderId: '2c92ce01-e59b-4966-9d3f-a03bdb85e3eb',
      },
    ]);
  });

  it('omits postOnly for FAK orders before submitting to the API', async () => {
    const { client, httpClient } = buildCreateOrderHarness();

    await client.createOrder({
      tokenId: '123',
      side: Side.BUY,
      price: 0.55,
      size: 10,
      orderType: OrderType.FAK,
      marketSlug: 'test-market',
      postOnly: true,
    } as any);

    const [, payload] = httpClient.post.mock.calls[0];
    expect(payload.orderType).toBe(OrderType.FAK);
    expect(payload.postOnly).toBeUndefined();
    expect(payload.timestamp).toBeUndefined();
    expect(payload.recvWindow).toBeUndefined();
  });

  it('sends receive-window fields as top-level create-order payload fields only', async () => {
    const { client, httpClient } = buildCreateOrderHarness();

    await client.createOrder({
      tokenId: '123',
      side: Side.BUY,
      price: 0.55,
      size: 10,
      orderType: OrderType.GTC,
      marketSlug: 'test-market',
      timestamp: 1770000000000,
      recvWindow: 1500,
    });

    const buildOrderArg = (client as any).orderBuilder.buildOrder.mock.calls[0][0];
    expect(buildOrderArg.timestamp).toBeUndefined();
    expect(buildOrderArg.recvWindow).toBeUndefined();

    const signOrderArg = (client as any).orderSigner.signOrder.mock.calls[0][0];
    expect(signOrderArg.timestamp).toBeUndefined();
    expect(signOrderArg.recvWindow).toBeUndefined();

    const [, payload] = httpClient.post.mock.calls[0];
    expect(payload.timestamp).toBe(1770000000000);
    expect(payload.recvWindow).toBe(1500);
    expect(payload.order.timestamp).toBeUndefined();
    expect(payload.order.recvWindow).toBeUndefined();
  });

  it('auto-stamps timestamp when recvWindow is supplied without timestamp', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1770000000123);
    const { client, httpClient } = buildCreateOrderHarness();

    try {
      await client.createOrder({
        tokenId: '123',
        side: Side.BUY,
        price: 0.55,
        size: 10,
        orderType: OrderType.GTC,
        marketSlug: 'test-market',
        recvWindow: 1500,
      });
    } finally {
      nowSpy.mockRestore();
    }

    const [, payload] = httpClient.post.mock.calls[0];
    expect(payload.timestamp).toBe(1770000000123);
    expect(payload.recvWindow).toBe(1500);
  });

  it.each([
    ['negative timestamp', { timestamp: -1 }, 'timestamp must be a non-negative integer'],
    ['fractional timestamp', { timestamp: 1.5 }, 'timestamp must be a non-negative integer'],
    ['zero recvWindow', { recvWindow: 0 }, 'recvWindow must be between 1 and 10000 milliseconds'],
    ['over-cap recvWindow', { recvWindow: 10001 }, 'recvWindow must be between 1 and 10000 milliseconds'],
    ['fractional recvWindow', { recvWindow: 1500.5 }, 'recvWindow must be an integer'],
  ])('rejects invalid receive-window options before submitting: %s', async (_name, receiveWindow, message) => {
    const { client, httpClient } = buildCreateOrderHarness();

    await expect(
      client.createOrder({
        tokenId: '123',
        side: Side.BUY,
        price: 0.55,
        size: 10,
        orderType: OrderType.GTC,
        marketSlug: 'test-market',
        ...receiveWindow,
      } as any)
    ).rejects.toThrow(message);

    expect(httpClient.post).not.toHaveBeenCalled();
  });
});
