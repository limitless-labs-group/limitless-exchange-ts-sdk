import { ethers } from 'ethers';
import { HttpClient } from '../api/http';
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

  async redeemPositions(params: RedeemServerWalletParams): Promise<RedeemServerWalletResponse> {
    this.requireHmacAuth('redeemServerWalletPositions');
    this.validateConditionId(params.conditionId);
    this.validateOnBehalfOf(params.onBehalfOf);

    this.logger.debug('Redeeming server-wallet positions', {
      conditionId: params.conditionId,
      onBehalfOf: params.onBehalfOf,
    });

    return this.httpClient.post<RedeemServerWalletResponse>('/portfolio/redeem', {
      conditionId: params.conditionId,
      onBehalfOf: params.onBehalfOf,
    });
  }

  async withdraw(params: WithdrawServerWalletParams): Promise<WithdrawServerWalletResponse> {
    this.requireHmacAuth('withdrawServerWalletFunds');
    this.validateAmount(params.amount);
    this.validateOnBehalfOf(params.onBehalfOf);

    if (params.token !== undefined) {
      this.validateAddress(params.token, 'token');
    }

    if (params.destination !== undefined) {
      this.validateAddress(params.destination, 'destination');
    }

    this.logger.debug('Withdrawing from server wallet', {
      amount: params.amount,
      onBehalfOf: params.onBehalfOf,
      token: params.token,
      destination: params.destination,
    });

    return this.httpClient.post<WithdrawServerWalletResponse>('/portfolio/withdraw', {
      amount: params.amount,
      onBehalfOf: params.onBehalfOf,
      ...(params.token !== undefined ? { token: params.token } : {}),
      ...(params.destination !== undefined ? { destination: params.destination } : {}),
    });
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
