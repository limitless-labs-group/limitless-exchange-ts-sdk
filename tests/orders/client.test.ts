import { describe, expect, it, vi } from 'vitest';
import { OrderClient } from '../../src/orders/client';
import { OrderBuilder } from '../../src/orders/builder';
import { CancelReplaceMode, OrderType, Side } from '../../src/types/orders';
import { APIError, ValidationError } from '../../src/api/errors';

const walletAddress = '0x0000000000000000000000000000000000000001';
const exchangeAddress = '0x0000000000000000000000000000000000000002';

function rawOrderResponse(payload: any, id: string = 'order-1') {
  return {
    order: {
      ...payload.order,
      id,
      createdAt: '2026-01-01T00:00:00.000Z',
      orderType: payload.orderType,
      marketId: 42,
    },
    makerMatches: [],
  };
}

function configuredClient(httpClient: any) {
  const client = new OrderClient({
    httpClient,
    wallet: { address: walletAddress } as any,
  });
  (client as any).orderSigner = {
    signOrder: vi.fn().mockResolvedValue(`0x${'a'.repeat(130)}`),
  };
  (client as any).marketFetcher = {
    getVenue: vi.fn().mockReturnValue({ exchange: exchangeAddress, adapter: null }),
  };
  return client;
}

const orderParams = {
  tokenId: '123',
  side: Side.BUY,
  price: 0.5,
  size: 2,
  orderType: OrderType.GTC,
  marketSlug: 'market',
} as const;

describe('OrderClient', () => {
  it.each([0, 150])(
    'prefers top-level effective fee %i over rank fee',
    async (effectiveFeeRateBps) => {
      const httpClient = {
        get: vi.fn().mockResolvedValue({
          id: 42,
          account: walletAddress,
          effectiveFeeRateBps,
          rank: { id: 1, name: 'rank', feeRateBps: 300 },
        }),
        post: vi
          .fn()
          .mockImplementation(async (_path: string, payload: any) => rawOrderResponse(payload)),
      };
      const client = configuredClient(httpClient);

      await client.createOrder(orderParams);

      expect(httpClient.post.mock.calls[0][1].order.feeRateBps).toBe(effectiveFeeRateBps);
    }
  );

  it('rebuilds, re-signs, and retries once with expected fee in raw response mode', async () => {
    const mismatch = new ValidationError(
      'fee mismatch',
      400,
      { code: 'FEE_RATE_MISMATCH', expectedFeeRateBps: 150 },
      '/orders',
      'POST'
    );
    const httpClient = {
      post: vi
        .fn()
        .mockRejectedValueOnce(mismatch)
        .mockImplementationOnce(async (_path: string, payload: any) => ({
          data: rawOrderResponse(payload, 'retried-order'),
          status: 201,
          headers: {},
        })),
    };
    const client = configuredClient(httpClient);
    (client as any).cachedUserData = { userId: 42, feeRateBps: 300 };
    (client as any).orderBuilder = new OrderBuilder(walletAddress, 300);
    const buildOrder = vi.spyOn(OrderBuilder.prototype, 'buildOrder');

    const response = await client.createOrder(orderParams, { withRawResponse: true });

    expect(buildOrder).toHaveBeenCalledTimes(2);
    expect((client as any).orderSigner.signOrder).toHaveBeenCalledTimes(2);
    expect(httpClient.post).toHaveBeenCalledTimes(2);
    expect(httpClient.post.mock.calls[0][1].order.feeRateBps).toBe(300);
    expect(httpClient.post.mock.calls[1][1].order.feeRateBps).toBe(150);
    expect(httpClient.post.mock.calls[0][1].order.salt).not.toBe(
      httpClient.post.mock.calls[1][1].order.salt
    );
    expect((client as any).cachedUserData.feeRateBps).toBe(150);
    expect(response.data.order.id).toBe('retried-order');
    expect(response.getRaw().status).toBe(201);
  });

  it.each([
    ['network error', new Error('timeout')],
    ['server error', new APIError('server error', 500, {}, '/orders', 'POST')],
    [
      'unknown mismatch',
      new ValidationError('fee mismatch', 400, { code: 'FEE_RATE_MISMATCH' }, '/orders', 'POST'),
    ],
  ])('does not retry %s', async (_name, error) => {
    const httpClient = { post: vi.fn().mockRejectedValue(error) };
    const client = configuredClient(httpClient);
    (client as any).cachedUserData = { userId: 42, feeRateBps: 300 };
    (client as any).orderBuilder = {
      buildOrder: vi.fn().mockReturnValue({ tokenId: '123', salt: 1, feeRateBps: 300 }),
    };

    await expect(client.createOrder(orderParams)).rejects.toBe(error);

    expect((client as any).orderBuilder.buildOrder).toHaveBeenCalledTimes(1);
    expect((client as any).orderSigner.signOrder).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

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
    const walletAddress = '0x0000000000000000000000000000000000000001';
    const signature = `0x${'a'.repeat(130)}`;
    const httpClient = {
      post: vi.fn().mockImplementation(async (_path: string, payload: any) => ({
        order: {
          id: 'order-fak',
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
  });

  it('builds and signs a direct cancel-replace replacement for the venue', async () => {
    const httpClient = { post: vi.fn().mockResolvedValue({ cancel: {}, replacement: {} }) } as any;
    const client = new OrderClient({
      httpClient,
      wallet: { address: '0x0000000000000000000000000000000000000001' } as any,
    });
    (client as any).cachedUserData = { userId: 42, feeRateBps: 300 };
    (client as any).orderBuilder = { buildOrder: vi.fn().mockReturnValue({ tokenId: '123' }) };
    (client as any).orderSigner = { signOrder: vi.fn().mockResolvedValue('0xsigned') };
    (client as any).marketFetcher = {
      getVenue: vi.fn().mockReturnValue({ exchange: '0x0000000000000000000000000000000000000002' }),
    };

    await client.cancelReplace({
      cancel: { clientOrderId: 'old-client-id' },
      mode: CancelReplaceMode.ALLOW_FAILURE,
      replacement: {
        tokenId: '123',
        side: Side.BUY,
        price: 0.5,
        size: 2,
        orderType: OrderType.GTC,
        marketSlug: 'market',
        clientOrderId: 'new-client-id',
        timestamp: 1000,
        recvWindow: 500,
        stpPolicy: 'cancel_taker',
        postOnly: true,
      },
    });

    const [path, body, config] = httpClient.post.mock.calls[0];
    const payload = JSON.parse(body);
    expect(path).toBe('/orders/cancel-replace');
    expect(payload.cancel).toEqual({ clientOrderId: 'old-client-id' });
    expect(payload.replacement).toMatchObject({
      ownerId: 42,
      clientOrderId: 'new-client-id',
      timestamp: 1000,
      recvWindow: 500,
      stpPolicy: 'cancel_taker',
      postOnly: true,
      order: { tokenId: '123', signature: '0xsigned' },
    });
    expect(payload.replacement.onBehalfOf).toBeUndefined();
    expect((client as any).orderSigner.signOrder).toHaveBeenCalledWith(
      { tokenId: '123' },
      expect.objectContaining({ contractAddress: '0x0000000000000000000000000000000000000002' })
    );
    expect(config.validateStatus(409)).toBe(true);
    expect(config.validateStatus(400)).toBe(false);
  });

  it('posts direct cancel-replace batches without imposing a local maximum', async () => {
    const httpClient = { post: vi.fn().mockResolvedValue({ results: [] }) } as any;
    const client = new OrderClient({ httpClient, wallet: { address: '0x1' } as any });
    (client as any).buildCancelReplaceReplacement = vi.fn().mockResolvedValue({ order: {} });
    const operation = {
      cancel: { orderId: 'old' },
      mode: CancelReplaceMode.STOP_ON_FAILURE,
      replacement: {
        tokenId: '1',
        side: Side.BUY,
        makerAmount: 1,
        orderType: OrderType.FOK,
        marketSlug: 'm',
      },
    } as const;

    await client.cancelReplaceBatch({ operations: Array.from({ length: 5 }, () => operation) });

    expect(httpClient.post.mock.calls[0][0]).toBe('/orders/cancel-replace/batch');
    expect(JSON.parse(httpClient.post.mock.calls[0][1]).operations).toHaveLength(5);
  });
});
