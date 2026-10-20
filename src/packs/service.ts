import { HttpClient } from '../api/http';
import type {
  Pack,
  PackQuoteParams,
  PackQuote,
  PackBuyParams,
  PackBuyResponse,
  PackPosition,
  PackPositions,
  PackClaimResponse,
  PackPollOptions,
} from '../types/packs';

const amountPattern = /^[1-9][0-9]{0,19}$/;
function amount(value: string): void {
  if (typeof value !== 'string' || !amountPattern.test(value))
    throw new Error(
      'Pack amounts and deadlines must be positive integer strings of at most 20 digits'
    );
}
function id(value: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    throw new Error('Pack/position ID must be a UUID');
  return value;
}
function profile(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647)
    throw new Error('onBehalfOf must be a positive 32-bit integer');
}
/** Integer-only slippage calculation, rounded down. */
export function packMinPayout(payout: string, slippageBps: number): string {
  amount(payout);
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10000)
    throw new Error('slippageBps must be between 0 and 9999');
  const result = (BigInt(payout) * BigInt(10000 - slippageBps)) / 10000n;
  if (result === 0n) throw new Error('minimum payout rounds to zero');
  return result.toString();
}
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Pack polling aborted'));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new Error('Pack polling aborted'));
    };
    const timer = setTimeout(
      () => {
        signal?.removeEventListener('abort', abort);
        resolve();
      },
      Math.max(0, ms)
    );
    signal?.addEventListener('abort', abort, { once: true });
  });
}
/** Reuse one service per partner. Calls are serialized and paced below 10 per 10s.
 * Writes are submitted once. Persist buy params yourself and replay unchanged.
 */
export class PacksService {
  private tail: Promise<unknown> = Promise.resolve();
  private next = 0;
  constructor(private readonly http: HttpClient) {}

  private call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    onBehalfOf?: number,
    signal?: AbortSignal
  ): Promise<T> {
    if (path.startsWith('/parlay/partner/') && !this.http.getHMACCredentials())
      return Promise.reject(
        new Error(
          'partner Packs require HMAC credentials with trading and delegated_signing scopes'
        )
      );
    const run = this.tail.then(async () => {
      await delay(this.next - Date.now(), signal);
      this.next = Date.now() + 1100;
      try {
        const config = {
          signal,
          headers: { 'x-on-behalf-of': onBehalfOf === undefined ? null : String(onBehalfOf) },
        };
        return method === 'GET'
          ? await this.http.get<T>(path, config)
          : await this.http.post<T>(path, body, config);
      } catch (error) {
        if ((error as { status?: number }).status === 429) this.next = Date.now() + 10000;
        throw error;
      }
    });
    this.tail = run.catch(() => undefined);
    return run;
  }
  list(): Promise<Pack[]> {
    return this.call('GET', '/parlay/packs');
  }
  search(query: string): Promise<Pack[]> {
    return this.call('GET', `/parlay/packs/search?query=${encodeURIComponent(query)}`);
  }
  get(packId: string): Promise<Pack> {
    return this.call('GET', `/parlay/packs/${id(packId)}`);
  }
  quote(params: PackQuoteParams): Promise<PackQuote> {
    id(params.packId);
    amount(params.stakeAmount);
    return this.call('POST', '/parlay/partner/quote', {
      packId: params.packId,
      stakeAmount: params.stakeAmount,
    });
  }
  buy(params: PackBuyParams): Promise<PackBuyResponse> {
    profile(params.onBehalfOf);
    id(params.packId);
    [params.stakeAmount, params.minPayoutAmount, params.deadline].forEach(amount);
    if (params.deadline.length > 12) throw new Error('deadline must contain at most 12 digits');
    if (
      typeof params.idempotencyKey !== 'string' ||
      !/^[\x21-\x7e]{1,128}$/.test(params.idempotencyKey)
    )
      throw new Error(
        'idempotencyKey must contain 1 to 128 printable ASCII characters without spaces'
      );
    // Snapshot before queueing; never derive a deadline/key or validate against the clock.
    return this.call('POST', '/parlay/partner/buy', {
      onBehalfOf: params.onBehalfOf,
      packId: params.packId,
      stakeAmount: params.stakeAmount,
      minPayoutAmount: params.minPayoutAmount,
      deadline: params.deadline,
      idempotencyKey: params.idempotencyKey,
    });
  }
  listPositions(onBehalfOf: number, limit = 20, offset = 0): Promise<PackPositions> {
    profile(onBehalfOf);
    if (!Number.isInteger(limit) || !Number.isInteger(offset))
      throw new Error('limit and offset must be integers');
    return this.call(
      'GET',
      `/parlay/partner/positions?limit=${Math.max(1, Math.min(50, limit))}&offset=${Math.max(0, Math.min(5000, offset))}`,
      undefined,
      onBehalfOf
    );
  }
  getPosition(onBehalfOf: number, positionId: string, signal?: AbortSignal): Promise<PackPosition> {
    profile(onBehalfOf);
    return this.call(
      'GET',
      `/parlay/partner/positions/${id(positionId)}`,
      undefined,
      onBehalfOf,
      signal
    );
  }
  /** Wait for minting, not for market settlement. */
  async waitForPosition(
    onBehalfOf: number,
    positionId: string,
    options: PackPollOptions = {}
  ): Promise<PackPosition> {
    return this.poll(
      async () => {
        const position = await this.getPosition(onBehalfOf, positionId, options.signal);
        if (['ACTIVE', 'WON', 'LOST'].includes(position.status)) return position;
        if (!['PENDING', 'FAILED'].includes(position.status))
          throw new Error(`Pack position ${positionId} is ${position.status}`);
        return undefined;
      },
      options,
      'Pack mint polling exhausted; replay the identical saved buy to distinguish NOT_SUBMITTED from recovery; do not rotate its key'
    );
  }
  claimOnce(
    onBehalfOf: number,
    positionId: string,
    signal?: AbortSignal
  ): Promise<PackClaimResponse> {
    profile(onBehalfOf);
    return this.call(
      'POST',
      `/parlay/partner/positions/${id(positionId)}/claim`,
      { onBehalfOf },
      undefined,
      signal
    );
  }
  /** Stops on every API error, especially PACK_SUBMISSION_UNKNOWN. */
  async claim(
    onBehalfOf: number,
    positionId: string,
    options: PackPollOptions = {}
  ): Promise<PackClaimResponse> {
    return this.poll(async () => {
      const result = await this.claimOnce(onBehalfOf, positionId, options.signal);
      if (result.status === 'CLAIMED') return result;
      if (!['APPROVAL_PENDING', 'CLAIM_PENDING'].includes(result.status))
        throw new Error(`unknown Pack claim status ${result.status}`);
      return undefined;
    }, options);
  }
  confirmClaim(onBehalfOf: number, positionId: string, txHash: string): Promise<PackClaimResponse> {
    profile(onBehalfOf);
    if (!/^0x[0-9a-f]{64}$/i.test(txHash))
      throw new Error('txHash must be a mined transaction hash');
    return this.call('POST', `/parlay/partner/positions/${id(positionId)}/claim/confirm`, {
      onBehalfOf,
      txHash,
    });
  }
  private async poll<T>(
    fn: () => Promise<T | undefined>,
    options: PackPollOptions,
    exhausted = 'Pack polling exhausted; resume with the same position/request'
  ): Promise<T> {
    const attempts = options.maxAttempts ?? 60,
      interval = options.intervalMs ?? 5000;
    if (
      !Number.isInteger(attempts) ||
      attempts < 1 ||
      !Number.isFinite(interval) ||
      interval < 1000
    )
      throw new Error('polling requires positive maxAttempts and intervalMs >= 1000');
    for (let i = 0; i < attempts; i++) {
      if (options.signal?.aborted) throw new Error('Pack polling aborted');
      const result = await fn();
      if (result !== undefined) return result;
      if (i + 1 < attempts) await delay(interval, options.signal);
    }
    throw new Error(exhausted);
  }
}
