import { HttpClient } from '../api/http';
import {
  SdkResponse,
  type ResponseOptions,
  type WithRawResponseOptions,
  type WithoutRawResponseOptions,
} from '../api/response';
import { OrderBuilder } from '../orders/builder';
import { ZERO_ADDRESS } from '../utils/constants';
import {
  type CancelResponse,
  type CreateDelegatedOrderParams,
  type CreateDelegatedOrderRequest,
  type DelegatedOrderResponse,
} from '../types/delegated-orders';
import { OrderType, SignatureType } from '../types/orders';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

const DEFAULT_DELEGATED_FEE_RATE_BPS = 300;

/**
 * Delegated partner-order operations.
 * @public
 */
export class DelegatedOrderService {
  private readonly httpClient: HttpClient;
  private readonly logger: ILogger;

  constructor(httpClient: HttpClient, logger?: ILogger) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
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

    const feeRateBps =
      params.feeRateBps && params.feeRateBps > 0
        ? params.feeRateBps
        : DEFAULT_DELEGATED_FEE_RATE_BPS;

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
