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
});

