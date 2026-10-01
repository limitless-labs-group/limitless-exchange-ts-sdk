import { describe, expect, it, vi } from 'vitest';
import type { HistoryEntry } from '../../src/types/portfolio';
import type {
  AmmPriceEntry,
  AmmPriceSnapshot,
  NewPriceData,
  PositionsSubscriptionOptions,
  TransactionEvent,
} from '../../src/types/websocket';

const ioMock = vi.fn();

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

/**
 * Wire shapes below are copied from the API source that produces them
 * (limitless-exchange-api @ 00724b1a4):
 * - newPriceData live frame: market/gateway/market-amm-socket.service.ts handleAmmPricesUpdated
 * - newPriceData snapshot:   market/gateway/market.gateway.ts sendInitialAmmPrices
 * - tx frame:                market/gateway/user-transaction-socket.service.ts UserTransactionEvent
 * - history rows:            portfolio/accessors/user-history.accessor.ts (taker + maker rows)
 */
describe('websocket and portfolio wire shapes', () => {
  it('types the live newPriceData frame as an array of price entries', () => {
    const live: NewPriceData = {
      marketAddress: '0x1234000000000000000000000000000000000000',
      updatedPrices: [
        {
          marketAddress: '0x1234000000000000000000000000000000000000',
          marketId: 42,
          noPrice: 0.35,
          yesPrice: 0.65,
        },
      ],
      blockNumber: 12345678,
      timestamp: '2026-10-01T00:00:00.000Z',
    };

    expect(Array.isArray(live.updatedPrices)).toBe(true);
    const entries = live.updatedPrices as AmmPriceEntry[];
    expect(entries[0].yesPrice).toBe(0.65);
    expect(entries[0].noPrice).toBe(0.35);
  });

  it('types the initial newPriceData snapshot as a single object with collateralDecimals', () => {
    const snapshot: NewPriceData = {
      marketAddress: '0x1234000000000000000000000000000000000000',
      updatedPrices: {
        collateralDecimals: 6,
        marketAddress: '0x1234000000000000000000000000000000000000',
        marketId: 42,
        noPrice: 0.35,
        yesPrice: 0.65,
      },
      blockNumber: 0,
      timestamp: '2026-10-01T00:00:00.000Z',
    };

    expect(Array.isArray(snapshot.updatedPrices)).toBe(false);
    const single = snapshot.updatedPrices as AmmPriceSnapshot;
    expect(single.collateralDecimals).toBe(6);

    // The normalisation documented on NewPriceData works for both shapes.
    const normalise = (data: NewPriceData) =>
      Array.isArray(data.updatedPrices) ? data.updatedPrices : [data.updatedPrices];
    expect(normalise(snapshot)).toHaveLength(1);
    expect(normalise(snapshot)[0].yesPrice).toBe(0.65);
  });

  it('types every field the server sets on a tx frame', () => {
    const tx: TransactionEvent = {
      userId: 7,
      txHash: '0xabc',
      status: 'CONFIRMED',
      source: 'CLOB_TRADE',
      timestamp: '2026-10-01T00:00:00.000Z',
      marketAddress: '0x1234000000000000000000000000000000000000',
      marketSlug: 'btc-100k-weekly',
      tokenId: '1',
      conditionId: '0xcond',
      amountContracts: '1000000',
      amountCollateral: '650000',
      price: '0.65',
      side: 'BUY',
      eventId: 'evt-1',
      tradeEventId: 'te-1',
      orderId: 'order-1',
      clientOrderId: 'my-tag-1',
      configuredFeeRateBps: 300,
      effectiveFeeBps: 150,
      feeAmountContracts: '3000',
      feeAmountCollateral: '0',
    };

    expect(tx.txHash).toBe('0xabc');
    expect(tx.status).toBe('CONFIRMED');
    expect(tx.orderId).toBe('order-1');
    expect(tx.tradeEventId).toBe('te-1');
    expect(tx.feeAmountCollateral).toBe('0');
  });

  it('types the CLOB ids on history rows', () => {
    const takerRow: HistoryEntry = {
      blockTimestamp: 1759276800,
      collateralAmount: '65',
      outcomeIndex: 0,
      outcomeTokenAmount: '100',
      outcomeTokenAmounts: ['100', '0'],
      outcomeTokenPrice: 0.65,
      orderId: 'c2f1e1d0-0000-4000-8000-000000000001',
      strategy: 'Market Buy',
      tradeEventId: 'c2f1e1d0-0000-4000-8000-000000000002',
      transactionHash: '0xabc',
    };
    const makerRow: HistoryEntry = {
      ...takerRow,
      makerMatchId: 'c2f1e1d0-0000-4000-8000-000000000003',
      strategy: 'Limit Buy',
    };

    expect(takerRow.orderId).toBeDefined();
    expect(takerRow.tradeEventId).toBeDefined();
    expect(takerRow.makerMatchId).toBeUndefined();
    expect(makerRow.makerMatchId).toBeDefined();
  });

  it('requires a market set on subscribe_positions', async () => {
    ioMock.mockReset();
    const { WebSocketClient } = await import('../../src/websocket/client');
    const client = new WebSocketClient({
      url: 'wss://ws.limitless.exchange',
      hmacCredentials: { tokenId: 'token-1', secret: Buffer.from('s').toString('base64') },
      autoReconnect: false,
    });

    const bySlug: PositionsSubscriptionOptions = { marketSlugs: ['btc-100k-weekly'] };
    const byAddress: PositionsSubscriptionOptions = {
      marketAddresses: ['0x1234000000000000000000000000000000000000'],
    };
    expect(bySlug.marketSlugs).toHaveLength(1);
    expect(byAddress.marketAddresses).toHaveLength(1);

    // Not connected, so every call rejects at runtime; the point of the
    // ts-expect-error below is the compile-time rejection of a payload-less
    // positions subscription, which the server silently ignores.
    await expect(client.subscribe('subscribe_positions', bySlug)).rejects.toThrow('not connected');
    await expect(client.subscribe('subscribe_order_events')).rejects.toThrow('not connected');
    // @ts-expect-error subscribe_positions must carry marketSlugs and/or marketAddresses
    await expect(client.subscribe('subscribe_positions')).rejects.toThrow('not connected');
  });
});
