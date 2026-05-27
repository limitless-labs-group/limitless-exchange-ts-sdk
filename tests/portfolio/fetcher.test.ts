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

  it('getProfile uses the provided address', async () => {
    const mockResponse = {
      id: 1,
      account: '0x1234',
    };

    vi.mocked(httpClient.get).mockResolvedValue(mockResponse);

    const result = await fetcher.getProfile(' 0x1234 ');

    expect(httpClient.get).toHaveBeenCalledWith('/profiles/0x1234');
    expect(result).toEqual(mockResponse);
  });

  it('getProfile uses the authenticated profile endpoint when address is omitted', async () => {
    const mockResponse = {
      id: 570,
      account: '0x1676716Ef7F19B5C5d690631CB57cf0bFD900A3d',
    };

    vi.mocked(httpClient.get).mockResolvedValue(mockResponse);

    const result = await fetcher.getProfile();

    expect(httpClient.get).toHaveBeenCalledWith('/profiles/me');
    expect(result).toEqual(mockResponse);
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
