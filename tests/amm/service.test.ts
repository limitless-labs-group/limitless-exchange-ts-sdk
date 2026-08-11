import { describe, expect, it, vi } from 'vitest';
import { AmmService } from '../../src/amm/service';
import type { HttpClient, HttpRawResponse } from '../../src/api/http';
import { ConflictError } from '../../src/api/errors';
import type {
  AmmAllowanceResponse,
  AmmBuyResponse,
  AmmSellResponse,
} from '../../src/types/amm';

const HMAC = { tokenId: 'token-1', secret: 'c2VjcmV0' };

function allowance(overrides: Partial<AmmAllowanceResponse> = {}): AmmAllowanceResponse {
  return {
    status: 'missing',
    confirmed: false,
    market: 'market-slug',
    marketAddress: '0xFPMM',
    side: 'BUY',
    walletAddress: '0xWallet',
    tokenAddress: '0xToken',
    spenderOrOperator: '0xFPMM',
    ...overrides,
  };
}

const BUY_RESPONSE: AmmBuyResponse = {
  status: 'SUBMITTED',
  market: 'market-slug',
  outcomeIndex: 0,
  collateralAmount: '1000000',
  expectedShares: '1763995',
  minShares: '1746355',
  transactionId: 'privy-tx',
  userOperationHash: '0xuserop',
};

const SELL_RESPONSE: AmmSellResponse = {
  status: 'SUBMITTED',
  market: 'market-slug',
  outcomeIndex: 0,
  collateralReturnAmount: '992015',
  expectedShares: '1959992',
  maxShares: '1979592',
};

function raw<T>(data: T, status = 200): HttpRawResponse<T> {
  return { status, headers: { 'x-request-id': `request-${status}` }, data } as HttpRawResponse<T>;
}

/** HMAC-authenticated mock transport with per-call overridable post handler. */
function hmacClient(post: ReturnType<typeof vi.fn>): HttpClient {
  return {
    requireAuth: vi.fn(),
    getHMACCredentials: vi.fn(() => HMAC),
    post,
    postWithIdentity: vi.fn(),
  } as unknown as HttpClient;
}

describe('AmmService allowances', () => {
  it('maps a BUY check with currentAllowance and a SELL check that omits it', async () => {
    const post = vi.fn(async (path: string, body: any) => {
      if (body.side === 'BUY') {
        return allowance({ side: 'BUY', currentAllowance: '0' });
      }
      return allowance({ side: 'SELL' });
    });
    const service = new AmmService(hmacClient(post));

    const buy = await service.checkAllowance({ market: 'market-slug', side: 'BUY' });
    expect(buy.currentAllowance).toBe('0');
    const sell = await service.checkAllowance({ market: 'market-slug', side: 'SELL' });
    expect(sell.currentAllowance).toBeUndefined();

    expect(post).toHaveBeenNthCalledWith(1, '/amm/allowances/check', {
      market: 'market-slug',
      side: 'BUY',
    });
  });

  it('handles 200 confirmed and 202 submitted approve responses', async () => {
    const confirmedPost = vi.fn(async () => allowance({ status: 'confirmed', confirmed: true }));
    const confirmed = await new AmmService(hmacClient(confirmedPost)).approveAllowance({
      market: 'm',
      side: 'BUY',
    });
    expect(confirmed.confirmed).toBe(true);

    const submittedPost = vi.fn(async () =>
      allowance({ status: 'submitted', transactionId: 'privy-tx' })
    );
    const submitted = await new AmmService(hmacClient(submittedPost)).approveAllowance({
      market: 'm',
      side: 'BUY',
    });
    expect(submitted.confirmed).toBe(false);
    expect(submitted.transactionId).toBe('privy-tx');
  });

  it('ensureAllowance approves once and polls check until confirmed', async () => {
    const calls: string[] = [];
    let checkCount = 0;
    const post = vi.fn(async (path: string) => {
      calls.push(path);
      if (path === '/amm/allowances/approve') {
        return allowance({ status: 'submitted' });
      }
      checkCount += 1;
      return allowance({
        status: checkCount >= 3 ? 'confirmed' : 'missing',
        confirmed: checkCount >= 3,
      });
    });
    const service = new AmmService(hmacClient(post));

    const result = await service.ensureAllowance(
      { market: 'market-slug', side: 'BUY' },
      { intervalMs: 1 }
    );

    expect(result.confirmed).toBe(true);
    expect(calls).toEqual([
      '/amm/allowances/check',
      '/amm/allowances/approve',
      '/amm/allowances/check',
      '/amm/allowances/check',
    ]);
    expect(calls.filter((p) => p === '/amm/allowances/approve')).toHaveLength(1);
  });

  it('ensureAllowance short-circuits when already confirmed (no approve)', async () => {
    const post = vi.fn(async () => allowance({ status: 'confirmed', confirmed: true }));
    const service = new AmmService(hmacClient(post));

    await service.ensureAllowance({ market: 'm', side: 'SELL' });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/amm/allowances/check', expect.anything());
  });
});

describe('AmmService trades', () => {
  it('buy sends the exact body and does not preflight allowances', async () => {
    const post = vi.fn(async () => BUY_RESPONSE);
    const service = new AmmService(hmacClient(post));

    await service.buy({
      market: 'market-slug',
      outcomeIndex: 0,
      collateralAmount: '1000000',
      slippageBps: 0,
      idempotencyKey: 'buy-key-1',
      onBehalfOf: 12345,
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/amm/buy', {
      market: 'market-slug',
      outcomeIndex: 0,
      collateralAmount: '1000000',
      idempotencyKey: 'buy-key-1',
      slippageBps: 0,
      onBehalfOf: 12345,
    });
  });

  it('omits slippageBps and onBehalfOf from the body when not provided', async () => {
    const post = vi.fn(async () => SELL_RESPONSE);
    const service = new AmmService(hmacClient(post));

    await service.sell({
      market: 'market-slug',
      outcomeIndex: 0,
      collateralReturnAmount: '992015',
      idempotencyKey: 'sell-key-1',
    });

    const body = post.mock.calls[0][1];
    expect(body).toEqual({
      market: 'market-slug',
      outcomeIndex: 0,
      collateralReturnAmount: '992015',
      idempotencyKey: 'sell-key-1',
    });
    expect('slippageBps' in body).toBe(false);
    expect('onBehalfOf' in body).toBe(false);
  });

  it('serializes an identical body on retry with the same params', async () => {
    const post = vi.fn(async () => BUY_RESPONSE);
    const service = new AmmService(hmacClient(post));
    const params = {
      market: 'market-slug',
      outcomeIndex: 0 as const,
      collateralAmount: '1000000',
      idempotencyKey: 'retry-key',
    };

    await service.buy(params);
    await service.buy(params);

    expect(JSON.stringify(post.mock.calls[0][1])).toBe(JSON.stringify(post.mock.calls[1][1]));
  });

  it('propagates a 409 idempotency conflict as ConflictError', async () => {
    const post = vi.fn(async () => {
      throw new ConflictError('Idempotency key was already used for a different AMM trade', 409);
    });
    const service = new AmmService(hmacClient(post));

    await expect(
      service.buy({
        market: 'market-slug',
        outcomeIndex: 0,
        collateralAmount: '1000000',
        idempotencyKey: 'dup-key',
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('handles responses without txHash and with independent identifiers', async () => {
    const post = vi.fn(async () => ({ ...BUY_RESPONSE, txHash: undefined }));
    const service = new AmmService(hmacClient(post));
    const result = await service.buy({
      market: 'm',
      outcomeIndex: 0,
      collateralAmount: '1',
      idempotencyKey: 'k',
    });
    expect(result.transactionId).toBe('privy-tx');
    expect(result.userOperationHash).toBe('0xuserop');
    expect(result.txHash).toBeUndefined();
  });
});

describe('AmmService validation', () => {
  const service = () => new AmmService(hmacClient(vi.fn(async () => BUY_RESPONSE)));
  const base = {
    market: 'market-slug',
    outcomeIndex: 0 as const,
    collateralAmount: '1000000',
    idempotencyKey: 'key',
  };

  it.each([
    ['zero', '0'],
    ['negative', '-1'],
    ['leading zero', '01'],
    ['decimal', '1.5'],
    ['scientific', '1e6'],
    ['whitespace', ' 1 '],
    ['empty', ''],
  ])('rejects invalid amount (%s)', async (_label, amount) => {
    await expect(service().buy({ ...base, collateralAmount: amount })).rejects.toThrow(
      /positive integer string/
    );
  });

  it('accepts the maximum uint256 amount', async () => {
    const maxUint256 = ((1n << 256n) - 1n).toString();
    await expect(service().buy({ ...base, collateralAmount: maxUint256 })).resolves.toBeDefined();
  });

  it('rejects an amount above uint256', async () => {
    const overflow = (1n << 256n).toString();
    await expect(service().buy({ ...base, collateralAmount: overflow })).rejects.toThrow(
      /positive integer string/
    );
  });

  it.each([-1, 2, 1.5])('rejects invalid outcomeIndex (%s)', async (outcomeIndex) => {
    await expect(
      service().buy({ ...base, outcomeIndex: outcomeIndex as 0 | 1 })
    ).rejects.toThrow(/outcomeIndex/);
  });

  it.each([-1, 1001, 5.5])('rejects invalid slippageBps (%s)', async (slippageBps) => {
    await expect(service().buy({ ...base, slippageBps })).rejects.toThrow(/slippageBps/);
  });

  it.each([0, 1000])('accepts boundary slippageBps (%s)', async (slippageBps) => {
    await expect(service().buy({ ...base, slippageBps })).resolves.toBeDefined();
  });

  it('rejects a blank idempotencyKey', async () => {
    await expect(service().buy({ ...base, idempotencyKey: '   ' })).rejects.toThrow(
      /idempotencyKey is required/
    );
  });

  it('rejects an idempotencyKey longer than 128 characters', async () => {
    await expect(
      service().buy({ ...base, idempotencyKey: 'x'.repeat(129) })
    ).rejects.toThrow(/at most 128/);
  });

  it('accepts a 128-character idempotencyKey', async () => {
    await expect(
      service().buy({ ...base, idempotencyKey: 'x'.repeat(128) })
    ).resolves.toBeDefined();
  });

  it.each([0, -1, 2147483648, 1.5])('rejects invalid onBehalfOf (%s)', async (onBehalfOf) => {
    await expect(service().buy({ ...base, onBehalfOf })).rejects.toThrow(/onBehalfOf/);
  });

  it('rejects a blank market', async () => {
    await expect(service().buy({ ...base, market: '   ' })).rejects.toThrow(/market is required/);
  });

  it('rejects an invalid allowance side (case-sensitive)', async () => {
    await expect(
      // @ts-expect-error deliberately invalid side casing
      service().checkAllowance({ market: 'm', side: 'buy' })
    ).rejects.toThrow(/side must be BUY or SELL/);
  });

  it('trims the market before sending', async () => {
    const post = vi.fn(async () => BUY_RESPONSE);
    await new AmmService(hmacClient(post)).buy({ ...base, market: '  market-slug  ' });
    expect(post.mock.calls[0][1].market).toBe('market-slug');
  });
});

describe('AmmService auth', () => {
  it('rejects legacy-API-key-only auth without making a request', async () => {
    const post = vi.fn();
    const client = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn(() => undefined),
      post,
      postWithIdentity: vi.fn(),
    } as unknown as HttpClient;

    await expect(
      new AmmService(client).buy({
        market: 'm',
        outcomeIndex: 0,
        collateralAmount: '1',
        idempotencyKey: 'k',
      })
    ).rejects.toThrow(/legacy API keys are not supported/);
    expect(post).not.toHaveBeenCalled();
  });

  it('uses identity-token auth when identityToken is supplied', async () => {
    const postWithIdentity = vi.fn(async () => BUY_RESPONSE);
    const post = vi.fn();
    const client = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn(() => undefined),
      post,
      postWithIdentity,
    } as unknown as HttpClient;

    await new AmmService(client).buy(
      { market: 'm', outcomeIndex: 0, collateralAmount: '1', idempotencyKey: 'k' },
      { identityToken: 'privy-identity' }
    );

    expect(postWithIdentity).toHaveBeenCalledWith('/amm/buy', 'privy-identity', expect.anything());
    expect(post).not.toHaveBeenCalled();
  });
});

describe('AmmService raw responses', () => {
  it('returns SdkResponse exposing status/headers/data', async () => {
    const post = vi.fn(async () => raw(BUY_RESPONSE, 201));
    const service = new AmmService(hmacClient(post));

    const response = await service.buy(
      { market: 'm', outcomeIndex: 0, collateralAmount: '1', idempotencyKey: 'k' },
      { withRawResponse: true }
    );

    expect(response.data).toEqual(BUY_RESPONSE);
    expect(response.getRaw().status).toBe(201);
    expect(response.getRaw().headers['x-request-id']).toBe('request-201');
  });

  it('returns raw approve responses with 202 status', async () => {
    const post = vi.fn(async () => raw(allowance({ status: 'submitted' }), 202));
    const service = new AmmService(hmacClient(post));

    const response = await service.approveAllowance(
      { market: 'm', side: 'BUY' },
      { withRawResponse: true }
    );

    expect(response.getRaw().status).toBe(202);
    expect(response.data.status).toBe('submitted');
  });
});
