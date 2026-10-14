import { describe, expect, it, vi } from 'vitest';
import { DelegatedOrderService } from '../../src/delegated-orders/service';
import { CancelReplaceMode, OrderType, Side } from '../../src/types/orders';
import type { HttpClient } from '../../src/api/http';
import { MarketFetcher } from '../../src/markets/fetcher';

const LEGACY_VENUE = {
  exchange: '0x0000000000000000000000000000000000000002',
  adapter: null,
};
const COLLATERAL_FEE_VENUE = {
  exchange: '0x0000000000000000000000000000000000000002',
  adapter: null,
  feeModule: '0x0000000000000000000000000000000000000003',
  feeModuleType: 'COLLATERAL',
};

function marketResponse(venue: object = LEGACY_VENUE) {
  return vi.fn().mockResolvedValue({ id: 1, slug: 'test-market', venue });
}

describe('DelegatedOrderService', () => {
  it('builds an unsigned delegated order payload and posts it on behalf of the target profile', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      get: marketResponse(),
      post: vi.fn().mockResolvedValue({ order: { id: 'delegated-1' } }),
    } as unknown as HttpClient;

    const service = new DelegatedOrderService(httpClient);
    const response = await service.createOrder({
      marketSlug: 'test-market',
      orderType: OrderType.GTC,
      onBehalfOf: 326,
      args: {
        tokenId: '123',
        side: Side.BUY,
        price: 0.55,
        size: 10,
      },
    });

    expect(response).toEqual({ order: { id: 'delegated-1' } });

    const [, payload] = (httpClient as any).post.mock.calls[0];
    expect(payload.marketSlug).toBe('test-market');
    expect(payload.ownerId).toBe(326);
    expect(payload.onBehalfOf).toBe(326);
    expect(payload.order.signature).toBeUndefined();
    expect(payload.order.signer).toBe('0x0000000000000000000000000000000000000000');
    expect(payload.order.maker).toBe('0x0000000000000000000000000000000000000000');
    expect(payload.order.feeRateBps).toBe(300);
  });

  it('cancels all on behalf of a target profile', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      delete: vi.fn().mockResolvedValue({ message: 'Orders canceled successfully' }),
    } as unknown as HttpClient;

    const service = new DelegatedOrderService(httpClient);
    const message = await service.cancelAllOnBehalfOf('market-slug', 326);

    expect(message).toBe('Orders canceled successfully');
    expect((httpClient as any).delete).toHaveBeenCalledWith(
      '/orders/all/market-slug?onBehalfOf=326'
    );
  });

  it('omits postOnly for FAK delegated orders before submitting to the API', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      get: marketResponse(),
      post: vi.fn().mockResolvedValue({ order: { id: 'delegated-fak' } }),
    } as unknown as HttpClient;

    const service = new DelegatedOrderService(httpClient);

    await service.createOrder({
      marketSlug: 'test-market',
      orderType: OrderType.FAK,
      onBehalfOf: 326,
      args: {
        tokenId: '123',
        side: Side.BUY,
        price: 0.55,
        size: 10,
        postOnly: true,
      } as any,
    });

    const [, payload] = (httpClient as any).post.mock.calls[0];
    expect(payload.orderType).toBe(OrderType.FAK);
    expect(payload.postOnly).toBeUndefined();
  });

  it('builds delegated cancel-replace with operation-level onBehalfOf and no signature', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      get: marketResponse(),
      post: vi.fn().mockResolvedValue({ cancel: {}, replacement: {} }),
    } as unknown as HttpClient;
    const service = new DelegatedOrderService(httpClient);

    await service.cancelReplace({
      cancel: { orderId: 'old-order' },
      mode: CancelReplaceMode.STOP_ON_FAILURE,
      onBehalfOf: 326,
      replacement: {
        tokenId: '123',
        side: Side.BUY,
        price: 0.55,
        size: 10,
        orderType: OrderType.GTC,
        marketSlug: 'market',
        clientOrderId: 'replacement',
      },
    });

    const [path, body, config] = (httpClient as any).post.mock.calls[0];
    const payload = JSON.parse(body);
    expect(path).toBe('/orders/cancel-replace');
    expect(payload.onBehalfOf).toBe(326);
    expect(payload.replacement.ownerId).toBe(326);
    expect(payload.replacement.onBehalfOf).toBeUndefined();
    expect(payload.replacement.order.signature).toBeUndefined();
    expect(config.validateStatus(409)).toBe(true);
    expect(config.validateStatus(400)).toBe(false);
  });

  describe('collateral fee venues', () => {
    it('submits feeRateBps 0 on a collateral fee venue even when a fee rate is requested', async () => {
      const httpClient = {
        requireAuth: vi.fn(),
        get: marketResponse(COLLATERAL_FEE_VENUE),
        post: vi.fn().mockResolvedValue({ order: { id: 'delegated-1' } }),
      } as unknown as HttpClient;
      const service = new DelegatedOrderService(httpClient);

      await service.createOrder({
        marketSlug: 'test-market',
        orderType: OrderType.FOK,
        onBehalfOf: 326,
        feeRateBps: 150,
        args: { tokenId: '123', side: Side.SELL, makerAmount: 10 },
      });

      expect((httpClient as any).get).toHaveBeenCalledWith('/markets/test-market');
      const [, payload] = (httpClient as any).post.mock.calls[0];
      expect(payload.order.feeRateBps).toBe(0);
    });

    it('keeps the requested fee rate on legacy venues', async () => {
      const httpClient = {
        requireAuth: vi.fn(),
        get: marketResponse(LEGACY_VENUE),
        post: vi.fn().mockResolvedValue({ order: { id: 'delegated-1' } }),
      } as unknown as HttpClient;
      const service = new DelegatedOrderService(httpClient);

      await service.createOrder({
        marketSlug: 'test-market',
        orderType: OrderType.GTC,
        onBehalfOf: 326,
        feeRateBps: 150,
        args: { tokenId: '123', side: Side.BUY, price: 0.55, size: 10 },
      });

      const [, payload] = (httpClient as any).post.mock.calls[0];
      expect(payload.order.feeRateBps).toBe(150);
    });

    it('uses the venue cached by a shared MarketFetcher without refetching the market', async () => {
      const httpClient = {
        requireAuth: vi.fn(),
        get: marketResponse(COLLATERAL_FEE_VENUE),
        post: vi.fn().mockResolvedValue({ order: { id: 'delegated-1' } }),
      } as unknown as HttpClient;
      const marketFetcher = new MarketFetcher(httpClient);
      await marketFetcher.getMarket('test-market');
      const service = new DelegatedOrderService(httpClient, undefined, marketFetcher);

      await service.createOrder({
        marketSlug: 'test-market',
        orderType: OrderType.GTC,
        onBehalfOf: 326,
        args: { tokenId: '123', side: Side.BUY, price: 0.55, size: 10 },
      });

      expect((httpClient as any).get).toHaveBeenCalledTimes(1);
      const [, payload] = (httpClient as any).post.mock.calls[0];
      expect(payload.order.feeRateBps).toBe(0);
    });

    it('builds cancel-replace replacements with feeRateBps 0 on a collateral fee venue', async () => {
      const httpClient = {
        requireAuth: vi.fn(),
        get: marketResponse(COLLATERAL_FEE_VENUE),
        post: vi.fn().mockResolvedValue({ results: [] }),
      } as unknown as HttpClient;
      const service = new DelegatedOrderService(httpClient);
      const replacement = {
        tokenId: '123',
        side: Side.BUY,
        price: 0.55,
        size: 10,
        orderType: OrderType.GTC,
        marketSlug: 'test-market',
      };

      await service.cancelReplaceBatch({
        operations: [
          {
            cancel: { orderId: 'old-order' },
            mode: CancelReplaceMode.STOP_ON_FAILURE,
            onBehalfOf: 326,
            replacement,
          },
        ],
      });

      const [path, body] = (httpClient as any).post.mock.calls[0];
      expect(path).toBe('/orders/cancel-replace/batch');
      expect(JSON.parse(body).operations[0].replacement.order.feeRateBps).toBe(0);
    });

    it('fetches each distinct uncached market once when building a cancel-replace batch', async () => {
      const get = vi.fn().mockImplementation(async (path: string) => {
        const slug = path.split('/').pop();
        return {
          id: 1,
          slug,
          venue: slug === 'collateral-market' ? COLLATERAL_FEE_VENUE : LEGACY_VENUE,
        };
      });
      const httpClient = {
        requireAuth: vi.fn(),
        get,
        post: vi.fn().mockResolvedValue({ results: [] }),
      } as unknown as HttpClient;
      const service = new DelegatedOrderService(httpClient);
      const operation = (marketSlug: string) => ({
        cancel: { orderId: `old-${marketSlug}` },
        mode: CancelReplaceMode.ALLOW_FAILURE,
        onBehalfOf: 326,
        replacement: {
          tokenId: '123',
          side: Side.BUY,
          price: 0.55,
          size: 10,
          orderType: OrderType.GTC,
          marketSlug,
        },
      });

      await service.cancelReplaceBatch({
        operations: [
          operation('collateral-market'),
          operation('collateral-market'),
          operation('legacy-market'),
          operation('collateral-market'),
        ],
      });

      expect(get).toHaveBeenCalledTimes(2);
      expect(get.mock.calls.map(([path]) => path).sort()).toEqual([
        '/markets/collateral-market',
        '/markets/legacy-market',
      ]);
      const [, body] = (httpClient as any).post.mock.calls[0];
      const fees = JSON.parse(body).operations.map((op: any) => op.replacement.order.feeRateBps);
      expect(fees).toEqual([0, 0, 300, 0]);
    });
  });
});
