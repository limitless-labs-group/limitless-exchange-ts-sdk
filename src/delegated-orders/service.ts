import { HttpClient } from '../api/http';
import { OrderBuilder } from '../orders/builder';
import { ZERO_ADDRESS } from '../utils/constants';
import {
  type CancelResponse,
  type CreateDelegatedOrderParams,
  type CreateDelegatedOrderRequest,
  type DelegatedOrderResponse,
} from '../types/delegated-orders';
import { SignatureType } from '../types/orders';
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

  async createOrder(params: CreateDelegatedOrderParams): Promise<DelegatedOrderResponse> {
    this.httpClient.requireAuth('createDelegatedOrder');

    if (!Number.isInteger(params.onBehalfOf) || params.onBehalfOf <= 0) {
      throw new Error('onBehalfOf must be a positive integer');
    }

    const feeRateBps = params.feeRateBps && params.feeRateBps > 0
      ? params.feeRateBps
      : DEFAULT_DELEGATED_FEE_RATE_BPS;

    const builder = new OrderBuilder(ZERO_ADDRESS, feeRateBps);
    const unsignedOrder = builder.buildOrder(params.args);

    const postOnly =
      'postOnly' in params.args && params.args.postOnly !== undefined
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

    return this.httpClient.post<DelegatedOrderResponse>('/orders', payload);
  }

  async cancel(orderId: string): Promise<string> {
    this.httpClient.requireAuth('cancelDelegatedOrder');
    const response = await this.httpClient.delete<CancelResponse>(`/orders/${encodeURIComponent(orderId)}`);
    return response.message;
  }

  async cancelOnBehalfOf(orderId: string, onBehalfOf: number): Promise<string> {
    this.httpClient.requireAuth('cancelDelegatedOrder');
    if (!Number.isInteger(onBehalfOf) || onBehalfOf <= 0) {
      throw new Error('onBehalfOf must be a positive integer');
    }

    const response = await this.httpClient.delete<CancelResponse>(
      `/orders/${encodeURIComponent(orderId)}?onBehalfOf=${onBehalfOf}`,
    );
    return response.message;
  }

  async cancelAll(marketSlug: string): Promise<string> {
    this.httpClient.requireAuth('cancelAllDelegatedOrders');
    const response = await this.httpClient.delete<CancelResponse>(`/orders/all/${encodeURIComponent(marketSlug)}`);
    return response.message;
  }

  async cancelAllOnBehalfOf(marketSlug: string, onBehalfOf: number): Promise<string> {
    this.httpClient.requireAuth('cancelAllDelegatedOrders');
    if (!Number.isInteger(onBehalfOf) || onBehalfOf <= 0) {
      throw new Error('onBehalfOf must be a positive integer');
    }

    const response = await this.httpClient.delete<CancelResponse>(
      `/orders/all/${encodeURIComponent(marketSlug)}?onBehalfOf=${onBehalfOf}`,
    );
    return response.message;
  }
}

