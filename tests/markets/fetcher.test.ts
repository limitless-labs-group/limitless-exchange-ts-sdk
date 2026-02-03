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
});
