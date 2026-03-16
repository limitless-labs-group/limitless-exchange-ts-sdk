import type { AxiosRequestConfig } from 'axios';
import { HttpClient } from '../api/http';
import { Market } from '../types/market-class';
import type {
  MarketPage,
  MarketPageMarketsParams,
  MarketPageMarketsResponse,
  NavigationNode,
  PropertyKey,
  PropertyOption,
} from '../types/market-pages';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

const MAX_REDIRECT_DEPTH = 3;

/**
 * Fetcher for market-pages and property-keys APIs.
 *
 * @remarks
 * This class provides access to the new navigation-driven market discovery API.
 *
 * @public
 */
export class MarketPageFetcher {
  private httpClient: HttpClient;
  private logger: ILogger;

  /**
   * Creates a new market-pages fetcher.
   *
   * @param httpClient - HTTP client for API calls
   * @param logger - Optional logger
   */
  constructor(httpClient: HttpClient, logger?: ILogger) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
  }

  /**
   * Gets the navigation tree.
   */
  async getNavigation(): Promise<NavigationNode[]> {
    this.logger.debug('Fetching navigation tree');
    return this.httpClient.get<NavigationNode[]>('/navigation');
  }

  /**
   * Resolves a market page by path.
   *
   * @remarks
   * Handles 301 redirects manually by re-requesting `/market-pages/by-path` with the
   * redirected path value from `Location` header.
   */
  async getMarketPageByPath(path: string): Promise<MarketPage> {
    return this.getMarketPageByPathInternal(path, 0);
  }

  private async getMarketPageByPathInternal(path: string, depth: number): Promise<MarketPage> {
    const query = new URLSearchParams({ path }).toString();
    const endpoint = `/market-pages/by-path?${query}`;

    const requestConfig: AxiosRequestConfig = {
      maxRedirects: 0,
      validateStatus: (status) => status === 200 || status === 301,
    };

    this.logger.debug('Resolving market page by path', { path, depth });

    const response = await this.httpClient.getRaw<MarketPage>(endpoint, requestConfig);

    if (response.status === 200) {
      return response.data;
    }

    if (response.status !== 301) {
      throw new Error(`Unexpected response status: ${response.status}`);
    }

    if (depth >= MAX_REDIRECT_DEPTH) {
      throw new Error(
        `Too many redirects while resolving market page path '${path}' (max ${MAX_REDIRECT_DEPTH})`
      );
    }

    const locationHeader = response.headers?.location;
    const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;

    if (!location || typeof location !== 'string') {
      throw new Error('Redirect response missing valid Location header');
    }

    const redirectedPath = this.extractRedirectPath(location);

    this.logger.info('Following market page redirect', {
      from: path,
      to: redirectedPath,
      depth: depth + 1,
    });

    return this.getMarketPageByPathInternal(redirectedPath, depth + 1);
  }

  private extractRedirectPath(location: string): string {
    const directByPathPrefix = '/market-pages/by-path';

    // Already in by-path format
    if (location.startsWith(directByPathPrefix)) {
      const url = new URL(location, 'https://api.limitless.exchange');
      const path = url.searchParams.get('path');
      if (!path) {
        throw new Error("Redirect location '/market-pages/by-path' is missing required 'path' query parameter");
      }
      return path;
    }

    // Absolute URL
    if (/^https?:\/\//i.test(location)) {
      const url = new URL(location);
      if (url.pathname === directByPathPrefix) {
        const path = url.searchParams.get('path');
        if (!path) {
          throw new Error("Redirect location '/market-pages/by-path' is missing required 'path' query parameter");
        }
        return path;
      }
      return url.pathname || '/';
    }

    // Path redirect as documented by backend (e.g. /sports/nba)
    return location;
  }

  /**
   * Gets markets for a market page with optional filtering and pagination.
   */
  async getMarkets(
    pageId: string,
    params: MarketPageMarketsParams = {}
  ): Promise<MarketPageMarketsResponse> {
    if (params.cursor !== undefined && params.page !== undefined) {
      throw new Error('Parameters `cursor` and `page` are mutually exclusive');
    }

    const query = new URLSearchParams();

    if (params.page !== undefined) {
      query.append('page', String(params.page));
    }

    if (params.limit !== undefined) {
      query.append('limit', String(params.limit));
    }

    if (params.sort) {
      query.append('sort', params.sort);
    }

    if (params.cursor !== undefined) {
      query.append('cursor', params.cursor);
    }

    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            query.append(key, this.stringifyFilterValue(item));
          }
        } else {
          query.append(key, this.stringifyFilterValue(value));
        }
      }
    }

    const queryString = query.toString();
    const endpoint = `/market-pages/${pageId}/markets${queryString ? `?${queryString}` : ''}`;

    this.logger.debug('Fetching market-page markets', { pageId, params });

    const response = await this.httpClient.get<any>(endpoint);
    const markets = (response.data || []).map((marketData: any) => new Market(marketData, this.httpClient));

    if (response.pagination) {
      return {
        data: markets,
        pagination: response.pagination,
      };
    }

    if (response.cursor) {
      return {
        data: markets,
        cursor: response.cursor,
      };
    }

    throw new Error('Invalid market-page response: expected `pagination` or `cursor` metadata');
  }

  /**
   * Lists all property keys with options.
   */
  async getPropertyKeys(): Promise<PropertyKey[]> {
    return this.httpClient.get<PropertyKey[]>('/property-keys');
  }

  /**
   * Gets a single property key by ID.
   */
  async getPropertyKey(id: string): Promise<PropertyKey> {
    return this.httpClient.get<PropertyKey>(`/property-keys/${id}`);
  }

  /**
   * Lists options for a property key, optionally filtered by parent option ID.
   */
  async getPropertyOptions(keyId: string, parentId?: string): Promise<PropertyOption[]> {
    const query = new URLSearchParams();
    if (parentId) {
      query.append('parentId', parentId);
    }

    const queryString = query.toString();
    const endpoint = `/property-keys/${keyId}/options${queryString ? `?${queryString}` : ''}`;

    return this.httpClient.get<PropertyOption[]>(endpoint);
  }

  private stringifyFilterValue(value: string | number | boolean): string {
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    return String(value);
  }
}
