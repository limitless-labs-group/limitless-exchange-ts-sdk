import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PortfolioFetcher } from '../../src/portfolio/fetcher';
import { HttpClient } from '../../src/api/http';
import type { HistoryResponse } from '../../src/types/portfolio';

describe('PortfolioFetcher', () => {
  let httpClient: HttpClient;
  let fetcher: PortfolioFetcher;

  beforeEach(() => {
    httpClient = {
      get: vi.fn(),
    } as unknown as HttpClient;

    fetcher = new PortfolioFetcher(httpClient);
  });

  it('getUserHistory sends empty cursor on the first page with default limit', async () => {
    const mockResponse: HistoryResponse = {
      data: [],
      nextCursor: null,
    };

    vi.mocked(httpClient.get).mockResolvedValue(mockResponse);

    const result = await fetcher.getUserHistory();

    const endpoint = vi.mocked(httpClient.get).mock.calls[0][0] as string;
    const params = new URLSearchParams(endpoint.split('?')[1]);

    expect(endpoint.startsWith('/portfolio/history?')).toBe(true);
    expect(endpoint).toBe('/portfolio/history?cursor=&limit=20');
    expect(params.get('cursor')).toBe('');
    expect(params.get('limit')).toBe('20');
    expect(result).toEqual(mockResponse);
  });

  it('getUserHistory forwards provided cursor and limit', async () => {
    const mockResponse: HistoryResponse = {
      data: [],
      nextCursor: 'cursor-2',
    };

    vi.mocked(httpClient.get).mockResolvedValue(mockResponse);

    await fetcher.getUserHistory('cursor-1', 5);

    expect(httpClient.get).toHaveBeenCalledWith('/portfolio/history?cursor=cursor-1&limit=5');
  });
});
