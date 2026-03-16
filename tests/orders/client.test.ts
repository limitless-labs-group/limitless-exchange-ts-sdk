import { describe, expect, it } from 'vitest';
import { OrderClient } from '../../src/orders/client';

describe('OrderClient', () => {
  it('normalizes numeric-string createOrder fields for makerAmount, takerAmount, and price', () => {
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

    // Out of scope: non-price payload fields are passed through unchanged.
    expect(transformed.order.salt).toBe('1742000000000000');
    expect(transformed.order.marketId).toBe('42');
  });
});
