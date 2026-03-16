import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketFetcher } from '../../src/markets/fetcher';
import { HttpClient } from '../../src/api/http';
import type { ActiveMarketsResponse, Market } from '../../src/types/markets';

describe('MarketFetcher', () => {
  let httpClient: HttpClient;
  let marketFetcher: MarketFetcher;

  beforeEach(() => {
    httpClient = new HttpClient('https://api.limitless.exchange');
    marketFetcher = new MarketFetcher(httpClient);
  });

  describe('getActiveMarkets', () => {
    it('should fetch active markets with limit parameter', async () => {
      const mockResponse: ActiveMarketsResponse = {
        data: [] as Market[],
        totalMarketsCount: 100,
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue(mockResponse);

      await marketFetcher.getActiveMarkets({ limit: 8 });

      expect(getSpy).toHaveBeenCalledWith('/markets/active?limit=8');
    });

    it('should fetch active markets sorted by lp_rewards', async () => {
      const mockResponse: ActiveMarketsResponse = {
        data: [] as Market[],
        totalMarketsCount: 50,
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue(mockResponse);

      await marketFetcher.getActiveMarkets({
        limit: 8,
        sortBy: 'lp_rewards',
      });

      expect(getSpy).toHaveBeenCalledWith('/markets/active?limit=8&sortBy=lp_rewards');
    });

    it('should fetch active markets sorted by ending_soon', async () => {
      const mockResponse: ActiveMarketsResponse = {
        data: [] as Market[],
        totalMarketsCount: 50,
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue(mockResponse);

      await marketFetcher.getActiveMarkets({
        limit: 8,
        sortBy: 'ending_soon',
      });

      expect(getSpy).toHaveBeenCalledWith('/markets/active?limit=8&sortBy=ending_soon');
    });

    it('should fetch active markets sorted by newest', async () => {
      const mockResponse: ActiveMarketsResponse = {
        data: [] as Market[],
        totalMarketsCount: 50,
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue(mockResponse);

      await marketFetcher.getActiveMarkets({
        limit: 8,
        sortBy: 'newest',
      });

      expect(getSpy).toHaveBeenCalledWith('/markets/active?limit=8&sortBy=newest');
    });

    it('should support pagination with page', async () => {
      const mockResponse: ActiveMarketsResponse = {
        data: [] as Market[],
        totalMarketsCount: 100,
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue(mockResponse);

      await marketFetcher.getActiveMarkets({
        limit: 8,
        page: 2,
        sortBy: 'lp_rewards',
      });

      expect(getSpy).toHaveBeenCalledWith('/markets/active?limit=8&page=2&sortBy=lp_rewards');
    });

    it('should handle all query parameters together', async () => {
      const mockResponse: ActiveMarketsResponse = {
        data: [] as Market[],
        totalMarketsCount: 100,
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue(mockResponse);

      await marketFetcher.getActiveMarkets({
        limit: 8,
        page: 3,
        sortBy: 'high_value',
      });

      expect(getSpy).toHaveBeenCalledWith('/markets/active?limit=8&page=3&sortBy=high_value');
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      vi.spyOn(httpClient, 'get').mockRejectedValue(error);

      await expect(
        marketFetcher.getActiveMarkets({ limit: 8, sortBy: 'lp_rewards' })
      ).rejects.toThrow('API Error');
    });

    it('should return correct data and totalMarketsCount', async () => {
      const mockResponse: ActiveMarketsResponse = {
        data: [] as Market[],
        totalMarketsCount: 100,
      };

      vi.spyOn(httpClient, 'get').mockResolvedValue(mockResponse);

      const result = await marketFetcher.getActiveMarkets({ limit: 8 });

      expect(result.totalMarketsCount).toBe(100);
      expect(result.data).toEqual([]);
    });

    it('should normalize string-encoded numeric fields in active markets payload', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValue({
        data: [
          {
            id: '1',
            slug: 'test-market',
            title: 'Test Market',
            proxyTitle: null,
            description: 'desc',
            collateralToken: { address: '0x1', decimals: '6', symbol: 'USDC' },
            expirationDate: '2026-01-01',
            expirationTimestamp: '1742000000000000',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            categories: [],
            status: 'OPEN',
            creator: { name: 'Creator', imageURI: null, link: null },
            tags: [],
            tradeType: 'CLOB',
            marketType: 'single',
            priorityIndex: '3',
            metadata: { fee: false },
            settings: {
              minSize: '10',
              maxSpread: '0.05',
              dailyReward: '0',
              rewardsEpoch: 'daily',
              c: '0',
              rebateRate: '1.25',
            },
            prices: ['0.2', '0.8'],
            tradePrices: {
              buy: { market: ['0.2', '0.8'], limit: ['0.21', '0.79'] },
              sell: { market: ['0.2', '0.8'], limit: ['0.19', '0.81'] },
            },
            venue: { exchange: '0xabc', adapter: null },
          },
        ],
        totalMarketsCount: '16',
      });

      const result = await marketFetcher.getActiveMarkets({ limit: 8 });
      const market = result.data[0];

      expect(result.totalMarketsCount).toBe(16);
      expect(market.id).toBe(1);
      expect(market.collateralToken.decimals).toBe(6);
      expect(market.expirationTimestamp).toBe(1742000000000000);
      expect(market.priorityIndex).toBe(3);
      expect(market.settings?.maxSpread).toBe(0.05);
      expect(market.settings?.rebateRate).toBe(1.25);
      expect(market.prices).toEqual([0.2, 0.8]);
      expect(market.tradePrices?.buy.market).toEqual([0.2, 0.8]);
      expect(market.tradePrices?.sell.limit).toEqual([0.19, 0.81]);
    });

    it('should handle response with markets data', async () => {
      const mockResponse: ActiveMarketsResponse = {
        data: [
          {
            id: 1,
            address: '0x123',
            title: 'Test',
            proxyTitle: null,
            description: 'Test',
            slug: 'test',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ] as Market[],
        totalMarketsCount: 16,
      };

      vi.spyOn(httpClient, 'get').mockResolvedValue(mockResponse);

      const result = await marketFetcher.getActiveMarkets({
        limit: 8,
        page: 2,
      });

      expect(result.data).toHaveLength(1);
      expect(result.totalMarketsCount).toBe(16);
    });
  });

  describe('getOrderBook', () => {
    it('should normalize string-encoded numeric fields in orderbook payload', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValue({
        bids: [{ price: '0.48', size: '120.5', side: 'BUY' }],
        asks: [{ price: '0.52', size: '99.25', side: 'SELL' }],
        tokenId: '123',
        adjustedMidpoint: '0.5',
        maxSpread: '0.1',
        minSize: '10',
        lastTradePrice: '0.49',
      });

      const result = await marketFetcher.getOrderBook('test-market');

      expect(result.adjustedMidpoint).toBe(0.5);
      expect(result.lastTradePrice).toBe(0.49);
      expect(result.bids[0].price).toBe(0.48);
      expect(result.bids[0].size).toBe(120.5);
      expect(result.asks[0].price).toBe(0.52);
      expect(result.asks[0].size).toBe(99.25);
    });
  });
});
