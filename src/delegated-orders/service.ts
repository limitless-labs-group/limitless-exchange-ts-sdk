import { HttpClient } from '../api/http';
import {
  SdkResponse,
  type ResponseOptions,
  type WithRawResponseOptions,
  type WithoutRawResponseOptions,
} from '../api/response';
import { MarketFetcher } from '../markets/fetcher';
import { isCollateralFeeVenue } from '../markets/venue';
import type { Venue } from '../types/markets';
import { OrderBuilder } from '../orders/builder';
import { ZERO_ADDRESS } from '../utils/constants';
import {
  type CancelResponse,
  type CreateDelegatedOrderParams,
  type CreateDelegatedOrderRequest,
  type DelegatedCancelReplaceBatchParams,
  type DelegatedCancelReplaceParams,
  type DelegatedCancelReplaceReplacementParams,
  type DelegatedCancelReplaceReplacementRequest,
  type DelegatedOrderResponse,
} from '../types/delegated-orders';
import type { CancelReplaceBatchResponse, CancelReplaceResponse } from '../types/orders';
import { OrderType, SignatureType } from '../types/orders';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

const DEFAULT_DELEGATED_FEE_RATE_BPS = 300;

/**
 * Delegated partner-order operations.
 *
 * @remarks
 * The market venue is resolved (from the shared venue cache, or by fetching the market)
 * so that orders on collateral fee venues are submitted with `feeRateBps = 0`.
 * Legacy venues keep the requested or default fee rate.
 *
 * @public
 */
export class DelegatedOrderService {
  private readonly httpClient: HttpClient;
  private readonly logger: ILogger;
  private readonly marketFetcher: MarketFetcher;

  /**
   * @param httpClient - HTTP client with partner credentials
   * @param logger - Optional logger
   * @param marketFetcher - Optional shared MarketFetcher used for venue caching
   */
  constructor(httpClient: HttpClient, logger?: ILogger, marketFetcher?: MarketFetcher) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
    this.marketFetcher = marketFetcher || new MarketFetcher(httpClient, this.logger);
  }

  async createOrder(
    params: CreateDelegatedOrderParams,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<DelegatedOrderResponse>>;
  async createOrder(
    params: CreateDelegatedOrderParams,
    options?: WithoutRawResponseOptions
  ): Promise<DelegatedOrderResponse>;
  async createOrder(
    params: CreateDelegatedOrderParams,
    options: ResponseOptions
  ): Promise<DelegatedOrderResponse | SdkResponse<DelegatedOrderResponse>>;
  async createOrder(
    params: CreateDelegatedOrderParams,
    options: ResponseOptions = {}
  ): Promise<DelegatedOrderResponse | SdkResponse<DelegatedOrderResponse>> {
    this.httpClient.requireAuth('createDelegatedOrder');

    if (!Number.isInteger(params.onBehalfOf) || params.onBehalfOf <= 0) {
      throw new Error('onBehalfOf must be a positive integer');
    }

    const venue = await this.resolveVenue(params.marketSlug);
    const feeRateBps = this.feeRateBpsForVenue(venue, params.feeRateBps);

    const builder = new OrderBuilder(ZERO_ADDRESS, feeRateBps);
    const unsignedOrder = builder.buildOrder(params.args);

    const postOnly =
      params.orderType === OrderType.GTC &&
      'postOnly' in params.args &&
      params.args.postOnly !== undefined
        ? params.args.postOnly
        : undefined;

    const payload: CreateDelegatedOrderRequest = {
      order: {
        salt: unsignedOrder.salt,
        maker: unsignedOrder.maker,
        signer: unsignedOrder.signer,
        taker: unsignedOrder.taker,
        tokenId: unsignedOrder.tokenId,
        makerAmount: unsignedOrder.makerAmount,
        takerAmount: unsignedOrder.takerAmount,
        expiration: unsignedOrder.expiration,
        nonce: unsignedOrder.nonce,
        feeRateBps: unsignedOrder.feeRateBps,
        side: unsignedOrder.side,
        signatureType: SignatureType.EOA,
        ...(unsignedOrder.price !== undefined ? { price: unsignedOrder.price } : {}),
      },
      orderType: params.orderType,
      marketSlug: params.marketSlug,
      ownerId: params.onBehalfOf,
      onBehalfOf: params.onBehalfOf,
      ...(postOnly !== undefined ? { postOnly } : {}),
    };

    this.logger.debug('Creating delegated order', {
      marketSlug: params.marketSlug,
      onBehalfOf: params.onBehalfOf,
      feeRateBps,
    });

    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.post<DelegatedOrderResponse>('/orders', payload, {
        withRawResponse: true,
      });
      return new SdkResponse(rawResponse.data, rawResponse);
    }
    return this.httpClient.post<DelegatedOrderResponse>('/orders', payload);
  }

  async cancel(
    orderId: string,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<string, CancelResponse>>;
  async cancel(orderId: string, options?: WithoutRawResponseOptions): Promise<string>;
  async cancel(
    orderId: string,
    options: ResponseOptions
  ): Promise<string | SdkResponse<string, CancelResponse>>;
  async cancel(
    orderId: string,
    options: ResponseOptions = {}
  ): Promise<string | SdkResponse<string, CancelResponse>> {
    this.httpClient.requireAuth('cancelDelegatedOrder');
    const endpoint = `/orders/${encodeURIComponent(orderId)}`;
    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.delete<CancelResponse>(endpoint, {
        withRawResponse: true,
      });
      return new SdkResponse(rawResponse.data.message, rawResponse);
    }
    const response = await this.httpClient.delete<CancelResponse>(endpoint);
    return response.message;
  }

  async cancelReplace(params: DelegatedCancelReplaceParams): Promise<CancelReplaceResponse> {
    this.httpClient.requireAuth('cancelReplaceDelegatedOrder');
    this.assertOnBehalfOf(params.onBehalfOf);
    const payload = {
      cancel: params.cancel,
      replacement: this.buildCancelReplaceReplacement(
        params.replacement,
        params.onBehalfOf,
        await this.resolveVenue(params.replacement.marketSlug)
      ),
      mode: params.mode,
      onBehalfOf: params.onBehalfOf,
    };
    const body = JSON.stringify(payload);

    return this.httpClient.post<CancelReplaceResponse>('/orders/cancel-replace', body, {
      validateStatus: (status) => (status >= 200 && status < 300) || status === 409,
    });
  }

  async cancelReplaceBatch(
    params: DelegatedCancelReplaceBatchParams
  ): Promise<CancelReplaceBatchResponse> {
    this.httpClient.requireAuth('cancelReplaceDelegatedOrderBatch');
    params.operations.forEach((operation) => this.assertOnBehalfOf(operation.onBehalfOf));
    const venues = await this.resolveVenues(
      params.operations.map((operation) => operation.replacement.marketSlug)
    );
    const operations = params.operations.map((operation) => ({
      cancel: operation.cancel,
      replacement: this.buildCancelReplaceReplacement(
        operation.replacement,
        operation.onBehalfOf,
        venues.get(operation.replacement.marketSlug)
      ),
      mode: operation.mode,
      onBehalfOf: operation.onBehalfOf,
    }));
    const body = JSON.stringify({ operations });

    return this.httpClient.post<CancelReplaceBatchResponse>('/orders/cancel-replace/batch', body);
  }

  private buildCancelReplaceReplacement(
    params: DelegatedCancelReplaceReplacementParams,
    onBehalfOf: number,
    venue: Venue | undefined
  ): DelegatedCancelReplaceReplacementRequest {
    const feeRateBps = this.feeRateBpsForVenue(venue, params.feeRateBps);
    const unsignedOrder = new OrderBuilder(ZERO_ADDRESS, feeRateBps).buildOrder(params);
    const postOnly =
      params.orderType === OrderType.GTC && 'postOnly' in params ? params.postOnly : undefined;

    return {
      order: unsignedOrder,
      orderType: params.orderType,
      marketSlug: params.marketSlug,
      ownerId: onBehalfOf,
      ...(postOnly !== undefined ? { postOnly } : {}),
      ...(params.clientOrderId !== undefined ? { clientOrderId: params.clientOrderId } : {}),
      ...(params.timestamp !== undefined ? { timestamp: params.timestamp } : {}),
      ...(params.recvWindow !== undefined ? { recvWindow: params.recvWindow } : {}),
      ...(params.stpPolicy !== undefined ? { stpPolicy: params.stpPolicy } : {}),
    };
  }

  private assertOnBehalfOf(onBehalfOf: number): void {
    if (!Number.isInteger(onBehalfOf) || onBehalfOf <= 0) {
      throw new Error('onBehalfOf must be a positive integer');
    }
  }

  /**
   * Resolves the venue of a market from the shared cache, fetching the market on a miss.
   *
   * @returns The venue, or `undefined` when the market exposes none (treated as a legacy venue)
   * @internal
   */
  private async resolveVenue(marketSlug: string): Promise<Venue | undefined> {
    const cached = this.marketFetcher.getVenue(marketSlug);
    if (cached) {
      return cached;
    }
    return (await this.marketFetcher.getMarket(marketSlug)).venue;
  }

  /**
   * Resolves the venues for a list of market slugs, fetching each distinct uncached market once.
   *
   * @internal
   */
  private async resolveVenues(marketSlugs: string[]): Promise<Map<string, Venue | undefined>> {
    const uniqueSlugs = [...new Set(marketSlugs)];
    const venues = await Promise.all(uniqueSlugs.map((slug) => this.resolveVenue(slug)));
    return new Map(uniqueSlugs.map((slug, index) => [slug, venues[index]]));
  }

  /**
   * Fee rate for a delegated order on the given venue.
   *
   * @remarks
   * Collateral fee venues require `feeRateBps = 0`. Legacy venues keep the requested
   * fee rate, or the default when none is provided.
   *
   * @internal
   */
  private feeRateBpsForVenue(venue: Venue | undefined, requestedFeeRateBps?: number): number {
    if (isCollateralFeeVenue(venue)) {
      return 0;
    }

    return requestedFeeRateBps && requestedFeeRateBps > 0
      ? requestedFeeRateBps
      : DEFAULT_DELEGATED_FEE_RATE_BPS;
  }

  async cancelOnBehalfOf(
    orderId: string,
    onBehalfOf: number,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<string, CancelResponse>>;
  async cancelOnBehalfOf(
    orderId: string,
    onBehalfOf: number,
    options?: WithoutRawResponseOptions
  ): Promise<string>;
  async cancelOnBehalfOf(
    orderId: string,
    onBehalfOf: number,
    options: ResponseOptions
  ): Promise<string | SdkResponse<string, CancelResponse>>;
  async cancelOnBehalfOf(
    orderId: string,
    onBehalfOf: number,
    options: ResponseOptions = {}
  ): Promise<string | SdkResponse<string, CancelResponse>> {
    this.httpClient.requireAuth('cancelDelegatedOrder');
    if (!Number.isInteger(onBehalfOf) || onBehalfOf <= 0) {
      throw new Error('onBehalfOf must be a positive integer');
    }

    const endpoint = `/orders/${encodeURIComponent(orderId)}?onBehalfOf=${onBehalfOf}`;
    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.delete<CancelResponse>(endpoint, {
        withRawResponse: true,
      });
      return new SdkResponse(rawResponse.data.message, rawResponse);
    }
    const response = await this.httpClient.delete<CancelResponse>(endpoint);
    return response.message;
  }

  async cancelAll(
    marketSlug: string,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<string, CancelResponse>>;
  async cancelAll(marketSlug: string, options?: WithoutRawResponseOptions): Promise<string>;
  async cancelAll(
    marketSlug: string,
    options: ResponseOptions
  ): Promise<string | SdkResponse<string, CancelResponse>>;
  async cancelAll(
    marketSlug: string,
    options: ResponseOptions = {}
  ): Promise<string | SdkResponse<string, CancelResponse>> {
    this.httpClient.requireAuth('cancelAllDelegatedOrders');
    const endpoint = `/orders/all/${encodeURIComponent(marketSlug)}`;
    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.delete<CancelResponse>(endpoint, {
        withRawResponse: true,
      });
      return new SdkResponse(rawResponse.data.message, rawResponse);
    }
    const response = await this.httpClient.delete<CancelResponse>(endpoint);
    return response.message;
  }

  async cancelAllOnBehalfOf(
    marketSlug: string,
    onBehalfOf: number,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<string, CancelResponse>>;
  async cancelAllOnBehalfOf(
    marketSlug: string,
    onBehalfOf: number,
    options?: WithoutRawResponseOptions
  ): Promise<string>;
  async cancelAllOnBehalfOf(
    marketSlug: string,
    onBehalfOf: number,
    options: ResponseOptions
  ): Promise<string | SdkResponse<string, CancelResponse>>;
  async cancelAllOnBehalfOf(
    marketSlug: string,
    onBehalfOf: number,
    options: ResponseOptions = {}
  ): Promise<string | SdkResponse<string, CancelResponse>> {
    this.httpClient.requireAuth('cancelAllDelegatedOrders');
    if (!Number.isInteger(onBehalfOf) || onBehalfOf <= 0) {
      throw new Error('onBehalfOf must be a positive integer');
    }

    const endpoint = `/orders/all/${encodeURIComponent(marketSlug)}?onBehalfOf=${onBehalfOf}`;
    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.delete<CancelResponse>(endpoint, {
        withRawResponse: true,
      });
      return new SdkResponse(rawResponse.data.message, rawResponse);
    }
    const response = await this.httpClient.delete<CancelResponse>(endpoint);
    return response.message;
  }
}
