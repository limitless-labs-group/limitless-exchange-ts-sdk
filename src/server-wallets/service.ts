import { ethers } from 'ethers';
import { HttpClient } from '../api/http';
import {
  SdkResponse,
  type ResponseOptions,
  type WithRawResponseOptions,
  type WithoutRawResponseOptions,
} from '../api/response';
import type {
  RedeemServerWalletParams,
  RedeemServerWalletResponse,
  WithdrawServerWalletParams,
  WithdrawServerWalletResponse,
} from '../types/server-wallets';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

const CONDITION_ID_REGEX = /^0x[a-fA-F0-9]{64}$/;
const INTEGER_STRING_REGEX = /^[0-9]+$/;
const HMAC_ONLY_ERROR =
  'Server wallet redeem/withdraw require HMAC-scoped API token auth; legacy API keys are not supported.';

/**
 * Server-managed wallet operations for delegated-signing partner flows.
 * @public
 */
export class ServerWalletService {
  private readonly httpClient: HttpClient;
  private readonly logger: ILogger;

  constructor(httpClient: HttpClient, logger?: ILogger) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
  }

  async redeemPositions(
    params: RedeemServerWalletParams,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<RedeemServerWalletResponse>>;
  async redeemPositions(
    params: RedeemServerWalletParams,
    options?: WithoutRawResponseOptions
  ): Promise<RedeemServerWalletResponse>;
  async redeemPositions(
    params: RedeemServerWalletParams,
    options: ResponseOptions
  ): Promise<RedeemServerWalletResponse | SdkResponse<RedeemServerWalletResponse>>;
  async redeemPositions(
    params: RedeemServerWalletParams,
    options: ResponseOptions = {}
  ): Promise<RedeemServerWalletResponse | SdkResponse<RedeemServerWalletResponse>> {
    this.requireHmacAuth('redeemServerWalletPositions');
    this.validateConditionId(params.conditionId);
    this.validateOnBehalfOf(params.onBehalfOf);

    this.logger.debug('Redeeming server-wallet positions', {
      conditionId: params.conditionId,
      onBehalfOf: params.onBehalfOf,
    });

    const payload = {
      conditionId: params.conditionId,
      onBehalfOf: params.onBehalfOf,
    };

    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.post<RedeemServerWalletResponse>(
        '/portfolio/redeem',
        payload,
        { withRawResponse: true }
      );
      return new SdkResponse(rawResponse.data, rawResponse);
    }
    return this.httpClient.post<RedeemServerWalletResponse>('/portfolio/redeem', payload);
  }

  async withdraw(
    params: WithdrawServerWalletParams,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<WithdrawServerWalletResponse>>;
  async withdraw(
    params: WithdrawServerWalletParams,
    options?: WithoutRawResponseOptions
  ): Promise<WithdrawServerWalletResponse>;
  async withdraw(
    params: WithdrawServerWalletParams,
    options: ResponseOptions
  ): Promise<WithdrawServerWalletResponse | SdkResponse<WithdrawServerWalletResponse>>;
  async withdraw(
    params: WithdrawServerWalletParams,
    options: ResponseOptions = {}
  ): Promise<WithdrawServerWalletResponse | SdkResponse<WithdrawServerWalletResponse>> {
    this.requireHmacAuth('withdrawServerWalletFunds');
    this.validateAmount(params.amount);

    if (params.onBehalfOf !== undefined) {
      this.validateOnBehalfOf(params.onBehalfOf);
    }

    if (params.token !== undefined) {
      this.validateAddress(params.token, 'token');
    }

    if (params.destination !== undefined) {
      this.validateAddress(params.destination, 'destination');
    }

    if (params.onBehalfOf === undefined && params.destination === undefined) {
      throw new Error('onBehalfOf or destination is required for withdraw');
    }

    this.logger.debug('Withdrawing from server wallet', {
      amount: params.amount,
      onBehalfOf: params.onBehalfOf,
      token: params.token,
      destination: params.destination,
    });

    const payload = {
      amount: params.amount,
      ...(params.onBehalfOf !== undefined ? { onBehalfOf: params.onBehalfOf } : {}),
      ...(params.token !== undefined ? { token: params.token } : {}),
      ...(params.destination !== undefined ? { destination: params.destination } : {}),
    };

    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.post<WithdrawServerWalletResponse>(
        '/portfolio/withdraw',
        payload,
        { withRawResponse: true }
      );
      return new SdkResponse(rawResponse.data, rawResponse);
    }
    return this.httpClient.post<WithdrawServerWalletResponse>('/portfolio/withdraw', payload);
  }

  private requireHmacAuth(operation: string): void {
    this.httpClient.requireAuth(operation);

    if (!this.httpClient.getHMACCredentials()) {
      throw new Error(HMAC_ONLY_ERROR);
    }
  }

  private validateConditionId(conditionId: string): void {
    if (typeof conditionId !== 'string' || !CONDITION_ID_REGEX.test(conditionId)) {
      throw new Error('conditionId must be a 0x-prefixed 32-byte hex string');
    }
  }

  private validateOnBehalfOf(onBehalfOf: number): void {
    if (!Number.isInteger(onBehalfOf) || onBehalfOf <= 0) {
      throw new Error('onBehalfOf must be a positive integer');
    }
  }

  private validateAmount(amount: string): void {
    if (typeof amount !== 'string' || !INTEGER_STRING_REGEX.test(amount) || BigInt(amount) <= 0n) {
      throw new Error('amount must be a positive integer string in the token smallest unit');
    }
  }

  private validateAddress(address: string, fieldName: 'token' | 'destination'): void {
    if (typeof address !== 'string' || !ethers.isAddress(address)) {
      throw new Error(`${fieldName} must be a valid EVM address`);
    }
  }
}
