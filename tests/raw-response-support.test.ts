import { describe, expect, it, vi } from 'vitest';
import type { HttpClient, HttpRawResponse } from '../src/api/http';
import { MarketFetcher } from '../src/markets/fetcher';
import { MarketPageFetcher } from '../src/market-pages/fetcher';
import { PortfolioFetcher } from '../src/portfolio/fetcher';
import { ApiTokenService } from '../src/api-tokens/service';
import { PartnerAccountService } from '../src/partner-accounts/service';
import { DelegatedOrderService } from '../src/delegated-orders/service';
import { ServerWalletService } from '../src/server-wallets/service';
import { OrderClient } from '../src/orders/client';
import { Market } from '../src/types/market-class';
import { OrderType, Side } from '../src/types/orders';

const RAW_OPTIONS = { withRawResponse: true } as const;

function raw<T>(data: T, status = 200): HttpRawResponse<T> {
  return {
    status,
    headers: { 'x-request-id': `request-${status}` },
    data,
  } as HttpRawResponse<T>;
}

describe('raw response support across domain methods', () => {
  it('covers all market methods while preserving Market transformations', async () => {
    const marketWire = {
      id: 1,
      slug: 'btc',
      title: 'BTC',
      proxyTitle: null,
      venue: { exchange: '0x0000000000000000000000000000000000000001', adapter: null },
    };
    const orderBook = {
      bids: [],
      asks: [],
      tokenId: '1',
      adjustedMidpoint: 0.5,
      maxSpread: '0.1',
      minSize: '1',
      lastTradePrice: 0.5,
    };
    const userOrdersWire = { orders: [{ id: 'order-1' }] };
    const get = vi.fn(async (path: string) => {
      if (path.startsWith('/markets/active'))
        return raw({ data: [marketWire], totalMarketsCount: 1 });
      if (path.endsWith('/orderbook')) return raw(orderBook);
      if (path.endsWith('/user-orders')) return raw(userOrdersWire);
      return raw(marketWire);
    });
    const fetcher = new MarketFetcher({ get } as unknown as HttpClient);

    const active = await fetcher.getActiveMarkets({}, RAW_OPTIONS);
    const market = await fetcher.getMarket('btc', RAW_OPTIONS);
    const book = await fetcher.getOrderBook('btc', RAW_OPTIONS);
    const orders = await market.data.getUserOrders(RAW_OPTIONS);

    expect(active.data.data[0]).toBeInstanceOf(Market);
    expect(active.getRaw().data.data[0]).toBe(marketWire);
    expect(market.data).toBeInstanceOf(Market);
    expect(market.getRaw().data).toBe(marketWire);
    expect(book.data).toBe(orderBook);
    expect(orders.data).toEqual([{ id: 'order-1' }]);
    expect(orders.getRaw().data).toBe(userOrdersWire);
    expect(get.mock.calls.every((call) => call[1]?.withRawResponse === true)).toBe(true);
  });

  it('covers all market-page methods, including final redirect metadata', async () => {
    const page = {
      id: 'page-1',
      name: 'Crypto',
      slug: 'crypto',
      fullPath: '/crypto',
      description: null,
      baseFilter: {},
      filterGroups: [],
      metadata: {},
      breadcrumb: [],
    };
    const marketWire = { id: 1, slug: 'btc', title: 'BTC', proxyTitle: null };
    const get = vi.fn(async (path: string) => {
      if (path === '/navigation')
        return raw([{ id: 'nav', name: 'Nav', slug: 'nav', path: '/nav', children: [] }]);
      if (path.startsWith('/market-pages/')) {
        return raw({
          data: [marketWire],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        });
      }
      if (path === '/property-keys') return raw([{ id: 'key-1' }]);
      if (path.endsWith('/options')) return raw([{ id: 'option-1' }]);
      return raw({ id: 'key-1' });
    });
    const getRaw = vi.fn().mockResolvedValue(raw(page, 200));
    const fetcher = new MarketPageFetcher({ get, getRaw } as unknown as HttpClient);

    const navigation = await fetcher.getNavigation(RAW_OPTIONS);
    const resolvedPage = await fetcher.getMarketPageByPath('/crypto', RAW_OPTIONS);
    const markets = await fetcher.getMarkets('page-1', {}, RAW_OPTIONS);
    const keys = await fetcher.getPropertyKeys(RAW_OPTIONS);
    const key = await fetcher.getPropertyKey('key-1', RAW_OPTIONS);
    const options = await fetcher.getPropertyOptions('key-1', undefined, RAW_OPTIONS);

    expect(navigation.getRaw().status).toBe(200);
    expect(resolvedPage.data).toBe(page);
    expect(resolvedPage.getRaw().status).toBe(200);
    expect(markets.data.data[0]).toBeInstanceOf(Market);
    expect(markets.getRaw().data.data[0]).toBe(marketWire);
    expect(keys.getRaw().data).toEqual([{ id: 'key-1' }]);
    expect(key.getRaw().data).toEqual({ id: 'key-1' });
    expect(options.getRaw().data).toEqual([{ id: 'option-1' }]);
  });

  it('covers all portfolio methods and retains the full positions body for subset helpers', async () => {
    const profile = { id: 1, account: '0xabc' };
    const positions = { clob: [{ id: 'clob-1' }], amm: [{ id: 'amm-1' }], accumulativePoints: 10 };
    const history = { data: [], nextCursor: null };
    const get = vi.fn(async (path: string) => {
      if (path.startsWith('/profiles/')) return raw(profile);
      if (path === '/portfolio/positions') return raw(positions);
      return raw(history);
    });
    const fetcher = new PortfolioFetcher({ get } as unknown as HttpClient);

    const profileResponse = await fetcher.getProfile(undefined, RAW_OPTIONS);
    const positionsResponse = await fetcher.getPositions(RAW_OPTIONS);
    const clob = await fetcher.getCLOBPositions(RAW_OPTIONS);
    const amm = await fetcher.getAMMPositions(RAW_OPTIONS);
    const historyResponse = await fetcher.getUserHistory(undefined, undefined, RAW_OPTIONS);

    expect(profileResponse.getRaw().data).toBe(profile);
    expect(positionsResponse.getRaw().data).toBe(positions);
    expect(clob.data).toEqual(positions.clob);
    expect(clob.getRaw().data).toBe(positions);
    expect(amm.data).toEqual(positions.amm);
    expect(amm.getRaw().data).toBe(positions);
    expect(historyResponse.getRaw().data).toBe(history);
  });

  it('covers all API-token methods, including identity auth and transformed messages', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      postWithIdentity: vi
        .fn()
        .mockResolvedValue(raw({ tokenId: 'token-1', secret: 'secret' }, 201)),
      get: vi.fn().mockResolvedValue(raw([{ tokenId: 'token-1' }])),
      getWithIdentity: vi
        .fn()
        .mockResolvedValue(raw({ tokenManagementEnabled: true, allowedScopes: [] })),
      delete: vi.fn().mockResolvedValue(raw({ message: 'revoked' })),
    } as unknown as HttpClient;
    const service = new ApiTokenService(httpClient);

    const derived = await service.deriveToken('identity', { scopes: ['trading'] }, RAW_OPTIONS);
    const listed = await service.listTokens(RAW_OPTIONS);
    const capabilities = await service.getCapabilities('identity', RAW_OPTIONS);
    const revoked = await service.revokeToken('token-1', RAW_OPTIONS);

    expect(derived.getRaw().status).toBe(201);
    expect(listed.getRaw().data).toEqual([{ tokenId: 'token-1' }]);
    expect(capabilities.getRaw().data.tokenManagementEnabled).toBe(true);
    expect(revoked.data).toBe('revoked');
    expect(revoked.getRaw().data).toEqual({ message: 'revoked' });
  });

  it('covers all partner-account methods, including headers, identity auth, and void deletes', async () => {
    const allowance = { profileId: 1, ready: true };
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({ tokenId: 'token', secret: 'secret' }),
      postWithHeaders: vi.fn().mockResolvedValue(raw({ profileId: 1, account: '0xabc' }, 201)),
      get: vi.fn(async (path: string) =>
        raw(path.includes('/allowances') ? allowance : { data: [], page: 1 })
      ),
      post: vi.fn().mockResolvedValue(raw(allowance, 202)),
      postWithIdentity: vi.fn().mockResolvedValue(raw({ id: 'address-1' }, 201)),
      deleteWithIdentity: vi.fn().mockResolvedValue(raw(undefined, 204)),
    } as unknown as HttpClient;
    const service = new PartnerAccountService(httpClient);

    const created = await service.createAccount(
      { createServerWallet: true },
      undefined,
      RAW_OPTIONS
    );
    const listed = await service.listAccounts({}, RAW_OPTIONS);
    const checked = await service.checkAllowances(1, RAW_OPTIONS);
    const retried = await service.retryAllowances(1, RAW_OPTIONS);
    const added = await service.addWithdrawalAddress('identity', { address: '0xabc' }, RAW_OPTIONS);
    const deleted = await service.deleteWithdrawalAddress('identity', '0xabc', RAW_OPTIONS);

    expect(created.getRaw().status).toBe(201);
    expect(listed.getRaw().data).toMatchObject({ page: 1 });
    expect(checked.getRaw().data).toBe(allowance);
    expect(retried.getRaw().status).toBe(202);
    expect(added.getRaw().status).toBe(201);
    expect(deleted.data).toBeUndefined();
    expect(deleted.getRaw().status).toBe(204);
  });

  it('covers all delegated-order methods and preserves cancellation response bodies', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      post: vi.fn().mockResolvedValue(raw({ order: { id: 'order-1' } }, 201)),
      delete: vi.fn().mockResolvedValue(raw({ message: 'cancelled' })),
    } as unknown as HttpClient;
    const service = new DelegatedOrderService(httpClient);
    const orderParams = {
      marketSlug: 'market',
      orderType: OrderType.GTC,
      onBehalfOf: 1,
      args: { tokenId: '1', side: Side.BUY, price: 0.5, size: 1 },
    } as const;

    const created = await service.createOrder(orderParams, RAW_OPTIONS);
    const cancelled = await service.cancel('order-1', RAW_OPTIONS);
    const cancelledForProfile = await service.cancelOnBehalfOf('order-1', 1, RAW_OPTIONS);
    const cancelledAll = await service.cancelAll('market', RAW_OPTIONS);
    const cancelledAllForProfile = await service.cancelAllOnBehalfOf('market', 1, RAW_OPTIONS);

    expect(created.getRaw().status).toBe(201);
    for (const response of [cancelled, cancelledForProfile, cancelledAll, cancelledAllForProfile]) {
      expect(response.data).toBe('cancelled');
      expect(response.getRaw().data).toEqual({ message: 'cancelled' });
    }
  });

  it('covers both server-wallet methods', async () => {
    const conditionId = `0x${'ab'.repeat(32)}`;
    const destination = '0x0F3262730c909408042F9Da345a916dc0e1F9787';
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({ tokenId: 'token', secret: 'secret' }),
      post: vi
        .fn()
        .mockResolvedValueOnce(raw({ conditionId, marketId: 1 }, 202))
        .mockResolvedValueOnce(raw({ amount: '1000', destination }, 202)),
    } as unknown as HttpClient;
    const service = new ServerWalletService(httpClient);

    const redeemed = await service.redeemPositions({ conditionId, onBehalfOf: 1 }, RAW_OPTIONS);
    const withdrawn = await service.withdraw({ amount: '1000', destination }, RAW_OPTIONS);

    expect(redeemed.getRaw().status).toBe(202);
    expect(redeemed.data.marketId).toBe(1);
    expect(withdrawn.getRaw().status).toBe(202);
    expect(withdrawn.data.amount).toBe('1000');
  });

  it('covers all remote order-client methods and keeps the unnormalized create body', async () => {
    const walletAddress = '0x0000000000000000000000000000000000000001';
    const rawOrder = {
      order: {
        id: 'order-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        makerAmount: '50',
        takerAmount: '100',
        expiration: '0',
        signatureType: 0,
        salt: '123',
        maker: walletAddress,
        signer: walletAddress,
        taker: '0x0000000000000000000000000000000000000000',
        tokenId: '1',
        side: Side.BUY,
        feeRateBps: 300,
        nonce: 0,
        signature: `0x${'a'.repeat(130)}`,
        orderType: OrderType.GTC,
        price: '0.5',
        marketId: 1,
      },
    };
    const httpClient = {
      post: vi.fn().mockResolvedValue(raw(rawOrder, 201)),
      delete: vi.fn().mockResolvedValue(raw({ message: 'cancelled' })),
    } as unknown as HttpClient;
    const client = new OrderClient({ httpClient, wallet: { address: walletAddress } as any });
    (client as any).cachedUserData = { userId: 1, feeRateBps: 300 };
    (client as any).orderBuilder = {
      buildOrder: vi.fn().mockReturnValue({
        salt: 123,
        maker: walletAddress,
        signer: walletAddress,
        taker: '0x0000000000000000000000000000000000000000',
        tokenId: '1',
        makerAmount: 50,
        takerAmount: 100,
        expiration: '0',
        nonce: 0,
        feeRateBps: 300,
        side: Side.BUY,
        signatureType: 0,
        price: 0.5,
      }),
    };
    (client as any).orderSigner = {
      signOrder: vi.fn().mockResolvedValue(rawOrder.order.signature),
    };
    (client as any).marketFetcher = {
      getVenue: vi.fn().mockReturnValue({
        exchange: '0x0000000000000000000000000000000000000002',
        adapter: null,
      }),
    };

    const created = await client.createOrder(
      {
        tokenId: '1',
        side: Side.BUY,
        price: 0.5,
        size: 1,
        orderType: OrderType.GTC,
        marketSlug: 'market',
      },
      RAW_OPTIONS
    );
    const cancelled = await client.cancel('order-1', RAW_OPTIONS);
    const cancelledAll = await client.cancelAll('market', RAW_OPTIONS);

    expect(created.data.order.makerAmount).toBe(50);
    expect(created.getRaw().data.order.makerAmount).toBe('50');
    expect(created.getRaw().status).toBe(201);
    expect(cancelled.getRaw().data).toEqual({ message: 'cancelled' });
    expect(cancelledAll.getRaw().data).toEqual({ message: 'cancelled' });
  });

  it('covers all AMM methods with the correct raw statuses', async () => {
    const allowanceBody = {
      status: 'confirmed',
      confirmed: true,
      market: 'market-slug',
      marketAddress: '0xFPMM',
      side: 'BUY',
      walletAddress: '0xWallet',
      tokenAddress: '0xToken',
      spenderOrOperator: '0xFPMM',
      currentAllowance: '0',
    };
    const buyBody = {
      status: 'SUBMITTED',
      market: 'market-slug',
      outcomeIndex: 0,
      collateralAmount: '1000000',
      expectedShares: '1763995',
      minShares: '1746355',
    };
    const sellBody = {
      status: 'SUBMITTED',
      market: 'market-slug',
      outcomeIndex: 0,
      collateralReturnAmount: '992015',
      expectedShares: '1959992',
      maxShares: '1979592',
    };

    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn(() => ({ tokenId: 'token-1', secret: 'c2VjcmV0' })),
      post: vi.fn(async (path: string) => {
        if (path === '/amm/allowances/check') return raw(allowanceBody, 200);
        if (path === '/amm/allowances/approve') return raw({ ...allowanceBody, status: 'submitted', confirmed: false }, 202);
        if (path === '/amm/buy') return raw(buyBody, 201);
        return raw(sellBody, 201);
      }),
      postWithIdentity: vi.fn(),
    } as unknown as HttpClient;
    const { AmmService } = await import('../src/amm/service');
    const amm = new AmmService(httpClient);

    const checked = await amm.checkAllowance({ market: 'market-slug', side: 'BUY' }, RAW_OPTIONS);
    const approved = await amm.approveAllowance({ market: 'market-slug', side: 'BUY' }, RAW_OPTIONS);
    const bought = await amm.buy(
      { market: 'market-slug', outcomeIndex: 0, collateralAmount: '1000000', idempotencyKey: 'k1' },
      RAW_OPTIONS
    );
    const sold = await amm.sell(
      { market: 'market-slug', outcomeIndex: 0, collateralReturnAmount: '992015', idempotencyKey: 'k2' },
      RAW_OPTIONS
    );

    expect(checked.getRaw().status).toBe(200);
    expect(checked.data.currentAllowance).toBe('0');
    expect(approved.getRaw().status).toBe(202);
    expect(bought.getRaw().status).toBe(201);
    expect(bought.data.minShares).toBe('1746355');
    expect(sold.getRaw().status).toBe(201);
    expect(sold.data.maxShares).toBe('1979592');
  });
});
