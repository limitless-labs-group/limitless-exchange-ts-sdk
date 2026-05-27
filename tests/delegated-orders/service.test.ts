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
    expect(payload.timestamp).toBeUndefined();
    expect(payload.recvWindow).toBeUndefined();
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

  it('sends delegated receive-window fields as top-level payload fields only', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      post: vi.fn().mockResolvedValue({ order: { id: 'delegated-rw' } }),
    } as unknown as HttpClient;

    const service = new DelegatedOrderService(httpClient);
    await service.createOrder({
      marketSlug: 'test-market',
      orderType: OrderType.GTC,
      onBehalfOf: 326,
      timestamp: 1770000000000,
      recvWindow: 1500,
      args: {
        tokenId: '123',
        side: Side.BUY,
        price: 0.55,
        size: 10,
      },
    });

    const [, payload] = (httpClient as any).post.mock.calls[0];
    expect(payload.timestamp).toBe(1770000000000);
    expect(payload.recvWindow).toBe(1500);
    expect(payload.order.timestamp).toBeUndefined();
    expect(payload.order.recvWindow).toBeUndefined();
  });

  it('auto-stamps delegated timestamp when recvWindow is supplied without timestamp', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1770000000123);
    const httpClient = {
      requireAuth: vi.fn(),
      post: vi.fn().mockResolvedValue({ order: { id: 'delegated-rw-auto' } }),
    } as unknown as HttpClient;

    const service = new DelegatedOrderService(httpClient);

    try {
      await service.createOrder({
        marketSlug: 'test-market',
        orderType: OrderType.GTC,
        onBehalfOf: 326,
        recvWindow: 1500,
        args: {
          tokenId: '123',
          side: Side.BUY,
          price: 0.55,
          size: 10,
        },
      });
    } finally {
      nowSpy.mockRestore();
    }

    const [, payload] = (httpClient as any).post.mock.calls[0];
    expect(payload.timestamp).toBe(1770000000123);
    expect(payload.recvWindow).toBe(1500);
  });

  it('rejects invalid delegated receive-window options before submitting', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      post: vi.fn(),
    } as unknown as HttpClient;

    const service = new DelegatedOrderService(httpClient);

    await expect(
      service.createOrder({
        marketSlug: 'test-market',
        orderType: OrderType.GTC,
        onBehalfOf: 326,
        recvWindow: 0,
        args: {
          tokenId: '123',
          side: Side.BUY,
          price: 0.55,
          size: 10,
        },
      })
    ).rejects.toThrow('recvWindow must be between 1 and 10000 milliseconds');

    expect((httpClient as any).post).not.toHaveBeenCalled();
  });
});
