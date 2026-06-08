import { describe, expect, it, vi } from 'vitest';
import { DelegatedOrderService } from '../../src/delegated-orders/service';
import { OrderType, Side } from '../../src/types/orders';
import type { HttpClient } from '../../src/api/http';

describe('DelegatedOrderService', () => {
  it('builds an unsigned delegated order payload and posts it on behalf of the target profile', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
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
    expect((httpClient as any).delete).toHaveBeenCalledWith('/orders/all/market-slug?onBehalfOf=326');
  });

  it('threads stpPolicy top-level on the delegated payload and surfaces execution', async () => {
    const execution = {
      matched: false,
      settlementStatus: 'CANCELED',
      reason: 'STP_TAKER_REJECTED',
      feeRateBps: 300,
      effectiveFeeBps: 0,
      totalsRaw: {
        contractsGross: '0',
        contractsFee: '0',
        contractsNet: '0',
        usdGross: '0',
        usdFee: '0',
        usdNet: '0',
      },
    };
    const httpClient = {
      requireAuth: vi.fn(),
      post: vi.fn().mockResolvedValue({ order: { id: 'delegated-stp' }, execution }),
    } as unknown as HttpClient;

    const service = new DelegatedOrderService(httpClient);

    const response = await service.createOrder({
      marketSlug: 'test-market',
      orderType: OrderType.GTC,
      onBehalfOf: 326,
      stpPolicy: 'cancel_taker',
      args: {
        tokenId: '123',
        side: Side.BUY,
        price: 0.55,
        size: 10,
      },
    });

    const [, payload] = (httpClient as any).post.mock.calls[0];
    expect(payload.stpPolicy).toBe('cancel_taker');
    expect('stpPolicy' in payload.order).toBe(false);

    // Delegated path returns the raw response, so execution is surfaced as-is.
    expect((response as any).execution).toEqual(execution);
  });

  it('omits stpPolicy from the delegated payload when unset', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      post: vi.fn().mockResolvedValue({ order: { id: 'delegated-no-stp' } }),
    } as unknown as HttpClient;

    const service = new DelegatedOrderService(httpClient);

    await service.createOrder({
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

    const [, payload] = (httpClient as any).post.mock.calls[0];
    expect('stpPolicy' in payload).toBe(false);
  });

  it('omits postOnly for FAK delegated orders before submitting to the API', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
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
});
