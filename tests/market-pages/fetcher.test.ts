import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketPageFetcher } from '../../src/market-pages/fetcher';
import { HttpClient } from '../../src/api/http';
import { APIError } from '../../src/api/errors';
import { Market } from '../../src/types/market-class';

describe('MarketPageFetcher', () => {
  let httpClient: HttpClient;
  let fetcher: MarketPageFetcher;

  beforeEach(() => {
    httpClient = {
      get: vi.fn(),
      getRaw: vi.fn(),
    } as unknown as HttpClient;

    fetcher = new MarketPageFetcher(httpClient);
  });

  it('getNavigation calls /navigation', async () => {
    const mockResponse = [{ id: '1', name: 'Crypto', slug: 'crypto', path: '/crypto', children: [] }];
    vi.mocked(httpClient.get).mockResolvedValue(mockResponse);

    const result = await fetcher.getNavigation();

    expect(httpClient.get).toHaveBeenCalledWith('/navigation');
    expect(result).toEqual(mockResponse);
  });

  it('getMarketPageByPath encodes query path and returns 200 response', async () => {
    const page = {
      id: 'page-1',
      name: 'Crypto',
      slug: 'crypto',
      fullPath: '/crypto',
      description: null,
      baseFilter: { logic: 'AND', conditions: [] },
      filterGroups: [],
      metadata: {},
      breadcrumb: [],
    };

    vi.mocked(httpClient.getRaw).mockResolvedValue({
      status: 200,
      headers: {},
      data: page,
    });

    const result = await fetcher.getMarketPageByPath('/crypto');

    const [endpoint, config] = vi.mocked(httpClient.getRaw).mock.calls[0];
    const params = new URLSearchParams((endpoint as string).split('?')[1]);

    expect((endpoint as string).startsWith('/market-pages/by-path?')).toBe(true);
    expect(params.get('path')).toBe('/crypto');
    expect(config).toMatchObject({ maxRedirects: 0 });
    expect(result).toEqual(page);
  });

  it('getMarketPageByPath follows 301 redirect using Location header', async () => {
    const target = {
      id: 'page-2',
      name: 'Sports',
      slug: 'sports',
      fullPath: '/sports',
      description: null,
      baseFilter: { logic: 'AND', conditions: [] },
      filterGroups: [],
      metadata: {},
      breadcrumb: [],
    };

    vi.mocked(httpClient.getRaw)
      .mockResolvedValueOnce({ status: 301, headers: { location: '/sports' }, data: null })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: target });

    const result = await fetcher.getMarketPageByPath('/old-sports');

    expect(httpClient.getRaw).toHaveBeenCalledTimes(2);
    const secondEndpoint = vi.mocked(httpClient.getRaw).mock.calls[1][0] as string;
    const secondParams = new URLSearchParams(secondEndpoint.split('?')[1]);
    expect(secondParams.get('path')).toBe('/sports');
    expect(result).toEqual(target);
  });

  it('getMarketPageByPath throws on excessive redirects', async () => {
    vi.mocked(httpClient.getRaw).mockResolvedValue({
      status: 301,
      headers: { location: '/next' },
      data: null,
    });

    await expect(fetcher.getMarketPageByPath('/start')).rejects.toThrow('Too many redirects');
    expect(httpClient.getRaw).toHaveBeenCalledTimes(4);
  });

  it('getMarketPageByPath throws on missing Location header', async () => {
    vi.mocked(httpClient.getRaw).mockResolvedValue({
      status: 301,
      headers: {},
      data: null,
    });

    await expect(fetcher.getMarketPageByPath('/start')).rejects.toThrow(
      'Redirect response missing valid Location header'
    );
  });

  it('getMarketPageByPath bubbles 404 APIError', async () => {
    vi.mocked(httpClient.getRaw).mockRejectedValue(
      new APIError('not found', 404, { message: 'not_found' }, '/market-pages/by-path', 'GET')
    );

    await expect(fetcher.getMarketPageByPath('/missing')).rejects.toThrow(APIError);
  });

  it('getMarkets serializes query params and maps response to Market instances', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: [
        {
          id: 1,
          slug: 'btc',
          title: 'BTC',
          proxyTitle: null,
          collateralToken: { address: '0x1', decimals: 6, symbol: 'USDC' },
          expirationDate: 'Jan 1, 2026',
          expirationTimestamp: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          categories: [],
          status: 'FUNDED',
          creator: { name: 'test' },
          tags: [],
          tradeType: 'clob',
          marketType: 'single',
          priorityIndex: 0,
          metadata: { fee: false },
        },
      ],
      pagination: { page: 2, limit: 10, total: 20, totalPages: 2 },
    });

    const result = await fetcher.getMarkets('page-1', {
      page: 2,
      limit: 10,
      sort: '-updatedAt',
      filters: { ticker: ['btc', 'eth'], duration: 'hourly' },
    });

    const endpoint = vi.mocked(httpClient.get).mock.calls[0][0] as string;
    const params = new URLSearchParams(endpoint.split('?')[1]);

    expect((endpoint as string).startsWith('/market-pages/page-1/markets?')).toBe(true);
    expect(params.get('page')).toBe('2');
    expect(params.get('limit')).toBe('10');
    expect(params.get('sort')).toBe('-updatedAt');
    expect(params.get('duration')).toBe('hourly');
    expect(params.getAll('ticker')).toEqual(['btc', 'eth']);

    expect(result).toHaveProperty('pagination');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toBeInstanceOf(Market);
  });

  it('getMarkets handles cursor mode and does not send page by default', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: [],
      cursor: { nextCursor: 'abc123' },
    });

    const result = await fetcher.getMarkets('page-1', {
      cursor: '',
      limit: 20,
      filters: { ticker: 'btc' },
    });

    const endpoint = vi.mocked(httpClient.get).mock.calls[0][0] as string;
    const params = new URLSearchParams(endpoint.split('?')[1]);

    expect(params.get('cursor')).toBe('');
    expect(params.has('page')).toBe(false);
    expect(result).toHaveProperty('cursor');
  });

  it('getMarkets throws on page + cursor conflict', async () => {
    await expect(
      fetcher.getMarkets('page-1', {
        page: 2,
        cursor: 'token',
      })
    ).rejects.toThrow('mutually exclusive');

    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it('getMarkets bubbles API errors (invalid cursor / conflict)', async () => {
    vi.mocked(httpClient.get).mockRejectedValue(
      new APIError('invalid cursor', 400, { message: 'invalid cursor' }, '/market-pages/page-1/markets', 'GET')
    );

    await expect(fetcher.getMarkets('page-1', { cursor: 'bad-token' })).rejects.toThrow(APIError);
  });

  it('getMarkets throws on invalid response shape', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ data: [] });

    await expect(fetcher.getMarkets('page-1')).rejects.toThrow(
      'Invalid market-page response: expected `pagination` or `cursor` metadata'
    );
  });

  it('getPropertyKeys calls correct endpoint', async () => {
    vi.mocked(httpClient.get).mockResolvedValue([]);

    await fetcher.getPropertyKeys();

    expect(httpClient.get).toHaveBeenCalledWith('/property-keys');
  });

  it('getPropertyKey calls correct endpoint', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ id: 'pk-1' });

    await fetcher.getPropertyKey('pk-1');

    expect(httpClient.get).toHaveBeenCalledWith('/property-keys/pk-1');
  });

  it('getPropertyOptions handles optional parentId query', async () => {
    vi.mocked(httpClient.get).mockResolvedValue([]);

    await fetcher.getPropertyOptions('pk-1', 'parent-1');

    expect(httpClient.get).toHaveBeenCalledWith('/property-keys/pk-1/options?parentId=parent-1');
  });
});
