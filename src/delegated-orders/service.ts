import { HttpClient } from '../api/http';
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

    return this.httpClient.post<DelegatedOrderResponse>('/orders', payload);
  }

  async cancelReplace(params: DelegatedCancelReplaceParams): Promise<CancelReplaceResponse> {
    this.httpClient.requireAuth('cancelReplaceDelegatedOrder');
    this.assertOnBehalfOf(params.onBehalfOf);
    const payload = {
      cancel: params.cancel,
      replacement: this.buildCancelReplaceReplacement(params.replacement, params.onBehalfOf),
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
    const operations = params.operations.map((operation) => {
      this.assertOnBehalfOf(operation.onBehalfOf);
      return {
        cancel: operation.cancel,
        replacement: this.buildCancelReplaceReplacement(
          operation.replacement,
          operation.onBehalfOf
        ),
        mode: operation.mode,
        onBehalfOf: operation.onBehalfOf,
      };
    });
    const body = JSON.stringify({ operations });

    return this.httpClient.post<CancelReplaceBatchResponse>('/orders/cancel-replace/batch', body);
  }

  private buildCancelReplaceReplacement(
    params: DelegatedCancelReplaceReplacementParams,
    onBehalfOf: number
  ): DelegatedCancelReplaceReplacementRequest {
    const feeRateBps =
      params.feeRateBps && params.feeRateBps > 0
        ? params.feeRateBps
        : DEFAULT_DELEGATED_FEE_RATE_BPS;
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

  async cancel(orderId: string): Promise<string> {
    this.httpClient.requireAuth('cancelDelegatedOrder');
    const response = await this.httpClient.delete<CancelResponse>(
      `/orders/${encodeURIComponent(orderId)}`
    );
    return response.message;
  }

  async cancelOnBehalfOf(orderId: string, onBehalfOf: number): Promise<string> {
    this.httpClient.requireAuth('cancelDelegatedOrder');
    if (!Number.isInteger(onBehalfOf) || onBehalfOf <= 0) {
      throw new Error('onBehalfOf must be a positive integer');
    }

    const response = await this.httpClient.delete<CancelResponse>(
      `/orders/${encodeURIComponent(orderId)}?onBehalfOf=${onBehalfOf}`
    );
    return response.message;
  }

  async cancelAll(marketSlug: string): Promise<string> {
    this.httpClient.requireAuth('cancelAllDelegatedOrders');
    const response = await this.httpClient.delete<CancelResponse>(
      `/orders/all/${encodeURIComponent(marketSlug)}`
    );
    return response.message;
  }

  async cancelAllOnBehalfOf(marketSlug: string, onBehalfOf: number): Promise<string> {
    this.httpClient.requireAuth('cancelAllDelegatedOrders');
    if (!Number.isInteger(onBehalfOf) || onBehalfOf <= 0) {
      throw new Error('onBehalfOf must be a positive integer');
    }

    const response = await this.httpClient.delete<CancelResponse>(
      `/orders/all/${encodeURIComponent(marketSlug)}?onBehalfOf=${onBehalfOf}`
    );
    return response.message;
  }
}
