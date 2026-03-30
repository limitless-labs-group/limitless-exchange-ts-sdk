import type { OrderArgs, OrderResponse, OrderType, SignatureType, Side } from './orders';

/**
 * Delegated-order creation parameters.
 * @public
 */
export interface CreateDelegatedOrderParams {
  marketSlug: string;
  orderType: OrderType;
  onBehalfOf: number;
  feeRateBps?: number;
  args: OrderArgs;
}

/**
 * Order submission payload where signature may be omitted.
 * @public
 */
export interface DelegatedOrderSubmission {
  salt: number;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: number;
  takerAmount: number;
  expiration: string;
  nonce: number;
  feeRateBps: number;
  side: Side;
  signatureType: SignatureType;
  price?: number;
  signature?: string;
}

/**
 * POST /orders payload for delegated flows.
 * @public
 */
export interface CreateDelegatedOrderRequest {
  order: DelegatedOrderSubmission;
  orderType: OrderType;
  marketSlug: string;
  ownerId: number;
  onBehalfOf?: number;
}

/**
 * Cancel endpoint response.
 * @public
 */
export interface CancelResponse {
  message: string;
}

/**
 * Re-export of the normal order response for delegated-create helpers.
 * @public
 */
export type DelegatedOrderResponse = OrderResponse;
