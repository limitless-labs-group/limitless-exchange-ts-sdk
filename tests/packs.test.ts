import { describe, it, expect, vi, afterEach } from 'vitest';
import { PacksService, packMinPayout } from '../src/packs/service';
import { HttpClient } from '../src/api/http';
import { APIError, RateLimitError } from '../src/api/errors';
import { classifyPackError } from '../src';

const packId = '22222222-2222-4222-8222-222222222222';
const params = {
  packId,
  onBehalfOf: 123,
  stakeAmount: '1000000',
  minPayoutAmount: '2000000',
  deadline: '1',
  idempotencyKey: 'order-1',
};
function setup() {
  const http = {
    getHMACCredentials: () => ({ tokenId: 'test', secret: 'test' }),
    get: vi.fn(),
    post: vi.fn(),
  };
  return { http, service: new PacksService(http as unknown as HttpClient) };
}
afterEach(() => vi.useRealTimers());
describe('partner Packs', () => {
  it('preserves minimal ineligible quotes', async () => {
    const { http, service } = setup();
    http.post.mockResolvedValue({ eligible: false, ineligibleReasons: ['Insufficient depth'] });
    const quote = await service.quote({ packId, stakeAmount: '1000000' });
    expect(quote.eligible).toBe(false);
    expect(quote.ineligibleReasons).toEqual(['Insufficient depth']);
    expect(quote.potentialPayout).toBeUndefined();
  });
  it('polls through FAILED recovery and bounds unresolved recovery', async () => {
    vi.useFakeTimers();
    const { http, service } = setup();
    http.get
      .mockResolvedValueOnce({ status: 'FAILED', txHash: '0xbroadcast' })
      .mockResolvedValueOnce({ status: 'ACTIVE' });
    const completed = service.waitForPosition(123, packId, { maxAttempts: 2 });
    await vi.runAllTimersAsync();
    expect((await completed).status).toBe('ACTIVE');
    http.get.mockResolvedValue({ status: 'FAILED' });
    const exhausted = expect(
      service.waitForPosition(123, packId, { maxAttempts: 2 })
    ).rejects.toThrow('replay the identical saved buy');
    await vi.runAllTimersAsync();
    await exhausted;
    expect(http.get).toHaveBeenCalledTimes(4);
    http.get.mockResolvedValue({ status: 'VAULT_REVERTED' });
    const reverted = expect(service.waitForPosition(123, packId)).rejects.toThrow('VAULT_REVERTED');
    await vi.runAllTimersAsync();
    await reverted;
    expect(http.get).toHaveBeenCalledTimes(5);
  });
  it('paces the next request for ten seconds after a real 429 error', async () => {
    vi.useFakeTimers();
    const { http, service } = setup();
    const error = new RateLimitError('slow down', 429, { retryAfterSeconds: 10 });
    http.post.mockRejectedValueOnce(error).mockResolvedValueOnce({ eligible: false });
    const failed = expect(service.quote({ packId, stakeAmount: '1000000' })).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(0);
    await failed;
    const next = service.quote({ packId, stakeAmount: '1000000' });
    await vi.advanceTimersByTimeAsync(9999);
    expect(http.post).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await next;
    expect(http.post).toHaveBeenCalledTimes(2);
  });
  it('exposes allowance and definitive failure metadata conservatively', () => {
    const allowance = classifyPackError(
      new APIError('approve', 409, {
        code: 'PACK_ALLOWANCE_REQUIRED',
        tokenAddress: '0xtoken',
        spender: '0xvault',
        requiredAllowance: '1000000',
      })
    );
    expect(allowance).toMatchObject({
      kind: 'ALLOWANCE_REQUIRED',
      spender: '0xvault',
      requiredAllowance: '1000000',
      tokenAddress: '0xtoken',
    });
    expect(
      classifyPackError(
        new APIError('invalid signature', 400, {
          code: 'BAD_INTENT_SIGNATURE',
          submissionState: 'NOT_SUBMITTED',
          parlayId: packId,
          recovery: 'Fix cause',
        })
      )
    ).toMatchObject({ kind: 'NOT_SUBMITTED', parlayId: packId, recovery: 'Fix cause' });
    for (const [status, data, message, kind] of [
      [409, { code: 'PRICE_DRIFTED' }, 'price', 'PRICE_DRIFTED'],
      [401, {}, 'Intent expired — please retry', 'INTENT_EXPIRED'],
      [401, {}, 'Invalid signature', 'OTHER'],
      [
        409,
        {},
        'Another Pack operation is in progress for this wallet; retry the same request',
        'WALLET_BUSY',
      ],
      [429, {}, 'rate limit', 'RATE_LIMITED'],
      [409, { code: 'PACK_TRANSACTION_REVERTED' }, 'reverted', 'TRANSACTION_REVERTED'],
      [
        409,
        { code: 'PACK_SUBMISSION_UNKNOWN', submissionState: 'NOT_SUBMITTED' },
        'unknown',
        'SUBMISSION_UNKNOWN',
      ],
      [500, { submissionState: 'NOT_SUBMITTED' }, 'Internal server error', 'OTHER'],
      [400, { submissionState: true }, 'malformed', 'OTHER'],
    ] as const) {
      expect(classifyPackError(new APIError(message, status, data)).kind).toBe(kind);
    }
    expect(classifyPackError(new Error('timeout')).kind).toBe('OTHER');
  });
  it('preserves an expired body across retries and snapshots queued input', async () => {
    vi.useFakeTimers();
    const { http, service } = setup();
    http.post.mockResolvedValue({ status: 'RECOVERING', position: { id: packId } });
    const input = { ...params };
    const first = service.buy(input);
    input.deadline = '999';
    await vi.runAllTimersAsync();
    await first;
    const second = service.buy(params);
    await vi.runAllTimersAsync();
    await second;
    expect(http.post.mock.calls.map((c) => c[1])).toEqual([params, params]);
    expect(http.post.mock.calls[0][2].headers['x-on-behalf-of']).toBeNull();
  });
  it('uses request-local delegation on paginated reads', async () => {
    vi.useFakeTimers();
    const { http, service } = setup();
    http.get.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });
    const result = service.listPositions(123, 100, -1);
    await vi.runAllTimersAsync();
    await result;
    expect(http.get).toHaveBeenCalledWith(
      '/parlay/partner/positions?limit=50&offset=0',
      expect.objectContaining({ headers: { 'x-on-behalf-of': '123' } })
    );
  });
  it('stops claim on unknown submission without retrying', async () => {
    vi.useFakeTimers();
    const { http, service } = setup();
    const error = Object.assign(new Error('receipt required'), {
      status: 409,
      data: { code: 'PACK_SUBMISSION_UNKNOWN' },
    });
    http.post.mockRejectedValue(error);
    const result = expect(service.claim(123, packId)).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await result;
    expect(http.post).toHaveBeenCalledTimes(1);
  });
  it('converges approval and claim steps with bounded polling', async () => {
    vi.useFakeTimers();
    const { http, service } = setup();
    http.post
      .mockResolvedValueOnce({ status: 'APPROVAL_PENDING' })
      .mockResolvedValueOnce({ status: 'CLAIM_PENDING' })
      .mockResolvedValueOnce({ status: 'CLAIMED', txHash: '0xreceipt' });
    const result = service.claim(123, packId);
    await vi.runAllTimersAsync();
    expect((await result).status).toBe('CLAIMED');
    expect(http.post).toHaveBeenCalledTimes(3);
  });
  it('validates amounts, keys and exact slippage arithmetic', () => {
    const { service } = setup();
    for (const stakeAmount of ['0', '01', '1e6', '1.5', '9'.repeat(21)])
      expect(() => service.buy({ ...params, stakeAmount })).toThrow();
    for (const idempotencyKey of ['', 'space key', 'é', 'x'.repeat(129)])
      expect(() => service.buy({ ...params, idempotencyKey })).toThrow();
    expect(packMinPayout('99999999999999999999', 100)).toBe('98999999999999999999');
  });
  it('rejects legacy authentication before sending a write', async () => {
    const service = new PacksService(new HttpClient({ apiKey: 'legacy' }));
    await expect(service.buy(params)).rejects.toThrow('HMAC');
  });
});
