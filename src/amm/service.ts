import { HttpClient } from '../api/http';
import {
  SdkResponse,
  type ResponseOptions,
  type WithRawResponseOptions,
  type WithoutRawResponseOptions,
} from '../api/response';
import type {
  AmmAllowanceParams,
  AmmAllowanceResponse,
  AmmAllowanceSide,
  AmmBuyParams,
  AmmBuyResponse,
  AmmEnsureAllowanceOptions,
  AmmOutcomeIndex,
  AmmSellParams,
  AmmSellResponse,
} from '../types/amm';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

const AMM_HMAC_ONLY_ERROR =
  'AMM operations require HMAC-scoped API token auth or an explicit Privy identity token; legacy API keys are not supported.';

const AMM_IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const AMM_MARKET_MAX_LENGTH = 255;
const AMM_AMOUNT_MAX_LENGTH = 78;
const AMM_MAX_ON_BEHALF_OF = 2147483647;
const AMM_DEFAULT_POLL_INTERVAL_MS = 2000;
const AMM_DEFAULT_MAX_POLL_ATTEMPTS = 30;

const AMM_POSITIVE_INTEGER_REGEX = /^[1-9][0-9]*$/;
const AMM_MAX_UINT256 = (1n << 256n) - 1n;

/**
 * Response options for AMM methods, extended with optional Privy identity auth.
 *
 * @remarks
 * When `identityToken` is set, the request is authenticated with a Privy
 * identity token; otherwise configured HMAC credentials are used. Legacy API
 * keys are rejected either way.
 *
 * @public
 */
export interface AmmResponseOptions extends ResponseOptions {
  identityToken?: string;
}

/** @public */
export interface AmmWithRawResponseOptions extends AmmResponseOptions {
  withRawResponse: true;
}

/** @public */
export interface AmmWithoutRawResponseOptions extends AmmResponseOptions {
  withRawResponse?: false;
}

/**
 * Partner AMM trading service: allowance setup and server-wallet buy/sell.
 *
 * @remarks
 * Approvals are set up once per wallet/market pair via {@link AmmService.ensureAllowance}
 * (or {@link AmmService.checkAllowance} + {@link AmmService.approveAllowance}). Buy and
 * sell never preflight allowances. All amounts are positive integer strings in the
 * market collateral token's base units.
 *
 * @public
 */
export class AmmService {
  private readonly httpClient: HttpClient;
  private readonly logger: ILogger;

  constructor(httpClient: HttpClient, logger?: ILogger) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
  }

  /**
   * Reads the live BUY or SELL approval state for a market.
   */
  async checkAllowance(
    params: AmmAllowanceParams,
    options: AmmWithRawResponseOptions
  ): Promise<SdkResponse<AmmAllowanceResponse>>;
  async checkAllowance(
    params: AmmAllowanceParams,
    options?: AmmWithoutRawResponseOptions
  ): Promise<AmmAllowanceResponse>;
  async checkAllowance(
    params: AmmAllowanceParams,
    options: AmmResponseOptions
  ): Promise<AmmAllowanceResponse | SdkResponse<AmmAllowanceResponse>>;
  async checkAllowance(
    params: AmmAllowanceParams,
    options: AmmResponseOptions = {}
  ): Promise<AmmAllowanceResponse | SdkResponse<AmmAllowanceResponse>> {
    const identityToken = this.resolveAuth('checkAmmAllowance', options);
    const payload = this.buildAllowanceRequest(params);
    this.logger.debug('Checking AMM allowance', {
      market: payload.market,
      side: payload.side,
      onBehalfOf: payload.onBehalfOf,
    });
    return this.send<AmmAllowanceResponse>('/amm/allowances/check', payload, identityToken, options);
  }

  /**
   * Submits a missing BUY or SELL approval.
   *
   * @remarks
   * A `submitted` response (HTTP 202) is not confirmation. Poll
   * {@link AmmService.checkAllowance} until `confirmed` is true.
   */
  async approveAllowance(
    params: AmmAllowanceParams,
    options: AmmWithRawResponseOptions
  ): Promise<SdkResponse<AmmAllowanceResponse>>;
  async approveAllowance(
    params: AmmAllowanceParams,
    options?: AmmWithoutRawResponseOptions
  ): Promise<AmmAllowanceResponse>;
  async approveAllowance(
    params: AmmAllowanceParams,
    options: AmmResponseOptions
  ): Promise<AmmAllowanceResponse | SdkResponse<AmmAllowanceResponse>>;
  async approveAllowance(
    params: AmmAllowanceParams,
    options: AmmResponseOptions = {}
  ): Promise<AmmAllowanceResponse | SdkResponse<AmmAllowanceResponse>> {
    const identityToken = this.resolveAuth('approveAmmAllowance', options);
    const payload = this.buildAllowanceRequest(params);
    this.logger.debug('Approving AMM allowance', {
      market: payload.market,
      side: payload.side,
      onBehalfOf: payload.onBehalfOf,
    });
    return this.send<AmmAllowanceResponse>(
      '/amm/allowances/approve',
      payload,
      identityToken,
      options
    );
  }

  /**
   * Submits an exact-collateral AMM buy.
   *
   * @remarks
   * Does not check or submit allowances. Reuse the same params when retrying so
   * the serialized body and idempotency key stay unchanged.
   */
  async buy(params: AmmBuyParams, options: AmmWithRawResponseOptions): Promise<SdkResponse<AmmBuyResponse>>;
  async buy(params: AmmBuyParams, options?: AmmWithoutRawResponseOptions): Promise<AmmBuyResponse>;
  async buy(
    params: AmmBuyParams,
    options: AmmResponseOptions
  ): Promise<AmmBuyResponse | SdkResponse<AmmBuyResponse>>;
  async buy(
    params: AmmBuyParams,
    options: AmmResponseOptions = {}
  ): Promise<AmmBuyResponse | SdkResponse<AmmBuyResponse>> {
    const identityToken = this.resolveAuth('buyAmmShares', options);
    const payload = this.buildBuyRequest(params);
    this.logger.debug('Buying AMM shares', {
      market: payload.market,
      outcomeIndex: payload.outcomeIndex,
      onBehalfOf: payload.onBehalfOf,
    });
    return this.send<AmmBuyResponse>('/amm/buy', payload, identityToken, options);
  }

  /**
   * Submits an exact-collateral-return AMM sell.
   *
   * @remarks
   * Does not check or submit allowances. Reuse the same params when retrying so
   * the serialized body and idempotency key stay unchanged.
   */
  async sell(params: AmmSellParams, options: AmmWithRawResponseOptions): Promise<SdkResponse<AmmSellResponse>>;
  async sell(params: AmmSellParams, options?: AmmWithoutRawResponseOptions): Promise<AmmSellResponse>;
  async sell(
    params: AmmSellParams,
    options: AmmResponseOptions
  ): Promise<AmmSellResponse | SdkResponse<AmmSellResponse>>;
  async sell(
    params: AmmSellParams,
    options: AmmResponseOptions = {}
  ): Promise<AmmSellResponse | SdkResponse<AmmSellResponse>> {
    const identityToken = this.resolveAuth('sellAmmShares', options);
    const payload = this.buildSellRequest(params);
    this.logger.debug('Selling AMM shares', {
      market: payload.market,
      outcomeIndex: payload.outcomeIndex,
      onBehalfOf: payload.onBehalfOf,
    });
    return this.send<AmmSellResponse>('/amm/sell', payload, identityToken, options);
  }

  /**
   * Checks an allowance, approves it at most once when missing, then polls the
   * allowance check until confirmation.
   *
   * @remarks
   * This is the recommended one-time setup per wallet/market pair. Buy and sell
   * never call this workflow automatically. Polling stops after `maxAttempts`
   * (default 30) checks, when the optional `signal` aborts, or on confirmation.
   */
  async ensureAllowance(
    params: AmmAllowanceParams,
    options: AmmEnsureAllowanceOptions = {}
  ): Promise<AmmAllowanceResponse> {
    const identityToken = this.resolveAuth('ensureAmmAllowance', {
      identityToken: options.identityToken,
    });
    const intervalMs = this.resolvePollInterval(options.intervalMs);
    const maxAttempts = this.resolveMaxAttempts(options.maxAttempts);
    const callOptions: AmmWithoutRawResponseOptions = { identityToken };

    const checked = await this.checkAllowance(params, callOptions);
    if (checked.confirmed) {
      return checked;
    }

    const approved = await this.approveAllowance(params, callOptions);
    if (approved.confirmed) {
      return approved;
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (options.signal?.aborted) {
        throw new Error('AMM allowance polling aborted');
      }
      await this.delay(intervalMs, options.signal);
      const next = await this.checkAllowance(params, callOptions);
      if (next.confirmed) {
        return next;
      }
    }

    throw new Error(
      `AMM allowance not confirmed after ${maxAttempts} checks; poll checkAllowance manually or raise maxAttempts`
    );
  }

  private async send<T>(
    path: string,
    payload: unknown,
    identityToken: string | undefined,
    options: ResponseOptions
  ): Promise<T | SdkResponse<T>> {
    if (options.withRawResponse) {
      const rawResponse = identityToken
        ? await this.httpClient.postWithIdentity<T>(path, identityToken, payload, {
            withRawResponse: true,
          })
        : await this.httpClient.post<T>(path, payload, { withRawResponse: true });
      return new SdkResponse(rawResponse.data, rawResponse);
    }

    return identityToken
      ? this.httpClient.postWithIdentity<T>(path, identityToken, payload)
      : this.httpClient.post<T>(path, payload);
  }

  private resolveAuth(operation: string, options: AmmResponseOptions): string | undefined {
    const identityToken = options.identityToken?.trim();
    if (identityToken) {
      return identityToken;
    }
    this.httpClient.requireAuth(operation);
    if (!this.httpClient.getHMACCredentials()) {
      throw new Error(AMM_HMAC_ONLY_ERROR);
    }
    return undefined;
  }

  private buildAllowanceRequest(params: AmmAllowanceParams): {
    market: string;
    side: AmmAllowanceSide;
    onBehalfOf?: number;
  } {
    const market = this.validateMarket(params.market);
    if (params.side !== 'BUY' && params.side !== 'SELL') {
      throw new Error('side must be BUY or SELL');
    }
    const onBehalfOf = this.validateOnBehalfOf(params.onBehalfOf);
    return this.withOnBehalfOf({ market, side: params.side }, onBehalfOf);
  }

  private buildBuyRequest(params: AmmBuyParams): {
    market: string;
    outcomeIndex: AmmOutcomeIndex;
    collateralAmount: string;
    slippageBps?: number;
    idempotencyKey: string;
    onBehalfOf?: number;
  } {
    const { market, onBehalfOf } = this.validateTradeParams(
      params.market,
      params.outcomeIndex,
      params.collateralAmount,
      'collateralAmount',
      params.slippageBps,
      params.idempotencyKey,
      params.onBehalfOf
    );
    return this.withTradeOptionals(
      {
        market,
        outcomeIndex: params.outcomeIndex,
        collateralAmount: params.collateralAmount,
        idempotencyKey: params.idempotencyKey,
      },
      params.slippageBps,
      onBehalfOf
    );
  }

  private buildSellRequest(params: AmmSellParams): {
    market: string;
    outcomeIndex: AmmOutcomeIndex;
    collateralReturnAmount: string;
    slippageBps?: number;
    idempotencyKey: string;
    onBehalfOf?: number;
  } {
    const { market, onBehalfOf } = this.validateTradeParams(
      params.market,
      params.outcomeIndex,
      params.collateralReturnAmount,
      'collateralReturnAmount',
      params.slippageBps,
      params.idempotencyKey,
      params.onBehalfOf
    );
    return this.withTradeOptionals(
      {
        market,
        outcomeIndex: params.outcomeIndex,
        collateralReturnAmount: params.collateralReturnAmount,
        idempotencyKey: params.idempotencyKey,
      },
      params.slippageBps,
      onBehalfOf
    );
  }

  private validateTradeParams(
    market: string,
    outcomeIndex: AmmOutcomeIndex,
    amount: string,
    amountField: string,
    slippageBps: number | undefined,
    idempotencyKey: string,
    onBehalfOf: number | undefined
  ): { market: string; onBehalfOf?: number } {
    const validatedMarket = this.validateMarket(market);
    if (outcomeIndex !== 0 && outcomeIndex !== 1) {
      throw new Error('outcomeIndex must be 0 (YES) or 1 (NO)');
    }
    this.validatePositiveIntegerAmount(amount, amountField);
    if (slippageBps !== undefined) {
      if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 1000) {
        throw new Error('slippageBps must be an integer between 0 and 1000');
      }
    }
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
      throw new Error('idempotencyKey is required');
    }
    if ([...idempotencyKey].length > AMM_IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new Error(`idempotencyKey must be at most ${AMM_IDEMPOTENCY_KEY_MAX_LENGTH} characters`);
    }
    const validatedOnBehalfOf = this.validateOnBehalfOf(onBehalfOf);
    return { market: validatedMarket, onBehalfOf: validatedOnBehalfOf };
  }

  private validateMarket(market: string): string {
    if (typeof market !== 'string') {
      throw new Error('market is required');
    }
    const trimmed = market.trim();
    if (trimmed === '') {
      throw new Error('market is required');
    }
    if ([...trimmed].length > AMM_MARKET_MAX_LENGTH) {
      throw new Error(`market must be at most ${AMM_MARKET_MAX_LENGTH} characters`);
    }
    return trimmed;
  }

  private validatePositiveIntegerAmount(value: string, field: string): void {
    const invalid = `${field} must be a positive integer string in the collateral token base unit`;
    if (typeof value !== 'string' || value.length > AMM_AMOUNT_MAX_LENGTH) {
      throw new Error(invalid);
    }
    if (!AMM_POSITIVE_INTEGER_REGEX.test(value)) {
      throw new Error(invalid);
    }
    let parsed: bigint;
    try {
      parsed = BigInt(value);
    } catch {
      throw new Error(invalid);
    }
    if (parsed <= 0n || parsed > AMM_MAX_UINT256) {
      throw new Error(invalid);
    }
  }

  private validateOnBehalfOf(onBehalfOf: number | undefined): number | undefined {
    if (onBehalfOf === undefined) {
      return undefined;
    }
    if (!Number.isInteger(onBehalfOf) || onBehalfOf < 1 || onBehalfOf > AMM_MAX_ON_BEHALF_OF) {
      throw new Error('onBehalfOf must be a positive 32-bit integer');
    }
    return onBehalfOf;
  }

  private withOnBehalfOf<T extends object>(payload: T, onBehalfOf: number | undefined): T & { onBehalfOf?: number } {
    return onBehalfOf === undefined ? payload : { ...payload, onBehalfOf };
  }

  private withTradeOptionals<T extends object>(
    payload: T,
    slippageBps: number | undefined,
    onBehalfOf: number | undefined
  ): T & { slippageBps?: number; onBehalfOf?: number } {
    let result: T & { slippageBps?: number; onBehalfOf?: number } = { ...payload };
    if (slippageBps !== undefined) {
      result = { ...result, slippageBps };
    }
    if (onBehalfOf !== undefined) {
      result = { ...result, onBehalfOf };
    }
    return result;
  }

  private resolvePollInterval(intervalMs: number | undefined): number {
    if (intervalMs === undefined) {
      return AMM_DEFAULT_POLL_INTERVAL_MS;
    }
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new Error('intervalMs must be a positive number');
    }
    return intervalMs;
  }

  private resolveMaxAttempts(maxAttempts: number | undefined): number {
    if (maxAttempts === undefined) {
      return AMM_DEFAULT_MAX_POLL_ATTEMPTS;
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new Error('maxAttempts must be a positive integer');
    }
    return maxAttempts;
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new Error('AMM allowance polling aborted'));
      };
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          reject(new Error('AMM allowance polling aborted'));
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }
}
