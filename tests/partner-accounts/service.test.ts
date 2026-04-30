import { describe, expect, it, vi } from 'vitest';
import { PartnerAccountService } from '../../src/partner-accounts/service';
import type { HttpClient } from '../../src/api/http';
import type { PartnerAccountAllowanceResponse } from '../../src/types/partner-accounts';
import { APIError, RateLimitError } from '../../src/api/errors';

const ALLOWANCE_RESPONSE: PartnerAccountAllowanceResponse = {
  profileId: 12345,
  partnerProfileId: 999,
  chainId: 8453,
  walletAddress: '0x1111111111111111111111111111111111111111',
  ready: false,
  summary: {
    total: 1,
    confirmed: 0,
    missing: 0,
    submitted: 1,
    failed: 0,
  },
  targets: [
    {
      type: 'USDC_ALLOWANCE',
      tokenAddress: '0x2222222222222222222222222222222222222222',
      spenderOrOperator: '0x3333333333333333333333333333333333333333',
      label: 'ctf-exchange',
      requiredFor: 'BUY',
      confirmed: false,
      status: 'submitted',
      transactionId: 'privy-transaction-id',
      txHash: '0xabc',
      userOperationHash: '0xdef',
      retryable: false,
    },
  ],
};

describe('PartnerAccountService', () => {
  it('creates a server-wallet account without EOA headers', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      postWithHeaders: vi.fn().mockResolvedValue({ profileId: 123, account: '0xabc' }),
    } as unknown as HttpClient;

    const service = new PartnerAccountService(httpClient);
    const response = await service.createAccount({
      displayName: 'child-account',
      createServerWallet: true,
    });

    expect(response).toEqual({ profileId: 123, account: '0xabc' });
    expect((httpClient as any).requireAuth).toHaveBeenCalledWith('createPartnerAccount');
    expect((httpClient as any).postWithHeaders).toHaveBeenCalledWith(
      '/profiles/partner-accounts',
      {
        displayName: 'child-account',
        createServerWallet: true,
      },
      undefined
    );
  });

  it('requires EOA headers when not creating a server wallet', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
    } as unknown as HttpClient;

    const service = new PartnerAccountService(httpClient);

    await expect(
      service.createAccount({
        displayName: 'child-account',
        createServerWallet: false,
      })
    ).rejects.toThrow('EOA headers are required');
  });

  it('passes EOA verification headers when provided', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      postWithHeaders: vi.fn().mockResolvedValue({ profileId: 123, account: '0xabc' }),
    } as unknown as HttpClient;

    const service = new PartnerAccountService(httpClient);
    const response = await service.createAccount(
      {
        displayName: 'child-account',
        createServerWallet: false,
      },
      {
        account: '0xabc',
        signingMessage: '0x1234',
        signature: '0xsig',
      }
    );

    expect(response).toEqual({ profileId: 123, account: '0xabc' });
    expect((httpClient as any).postWithHeaders).toHaveBeenCalledWith(
      '/profiles/partner-accounts',
      {
        displayName: 'child-account',
        createServerWallet: false,
      },
      {
        'x-account': '0xabc',
        'x-signing-message': '0x1234',
        'x-signature': '0xsig',
      }
    );
  });

  it('rejects display names longer than 44 characters', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
    } as unknown as HttpClient;

    const service = new PartnerAccountService(httpClient);

    await expect(
      service.createAccount({
        displayName: 'x'.repeat(45),
        createServerWallet: true,
      })
    ).rejects.toThrow('displayName must be at most 44 characters');
  });

  it('checks partner-account allowance readiness', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({
        tokenId: 'token-1',
        secret: 'secret-1',
      }),
      get: vi.fn().mockResolvedValue(ALLOWANCE_RESPONSE),
    } as unknown as HttpClient;

    const service = new PartnerAccountService(httpClient);
    const response = await service.checkAllowances(12345);

    expect(response).toEqual(ALLOWANCE_RESPONSE);
    expect((httpClient as any).requireAuth).toHaveBeenCalledWith('checkPartnerAccountAllowances');
    expect((httpClient as any).get).toHaveBeenCalledWith(
      '/profiles/partner-accounts/12345/allowances'
    );
  });

  it('retries partner-account allowance recovery with an empty body', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({
        tokenId: 'token-1',
        secret: 'secret-1',
      }),
      post: vi.fn().mockResolvedValue(ALLOWANCE_RESPONSE),
    } as unknown as HttpClient;

    const service = new PartnerAccountService(httpClient);
    const response = await service.retryAllowances(12345);

    expect(response).toEqual(ALLOWANCE_RESPONSE);
    expect((httpClient as any).requireAuth).toHaveBeenCalledWith('retryPartnerAccountAllowances');
    expect((httpClient as any).post).toHaveBeenCalledWith(
      '/profiles/partner-accounts/12345/allowances/retry',
      {}
    );
  });

  it('propagates retry rate-limit and conflict errors', async () => {
    const rateLimitError = new RateLimitError(
      'rate limited',
      429,
      { message: 'rate limited', retryAfterSeconds: 42 },
      '/profiles/partner-accounts/12345/allowances/retry',
      'POST'
    );
    const conflictError = new APIError(
      'allowance retry already running',
      409,
      { message: 'allowance retry already running' },
      '/profiles/partner-accounts/67890/allowances/retry',
      'POST'
    );
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({
        tokenId: 'token-1',
        secret: 'secret-1',
      }),
      post: vi.fn().mockRejectedValueOnce(rateLimitError).mockRejectedValueOnce(conflictError),
    } as unknown as HttpClient;

    const service = new PartnerAccountService(httpClient);

    await expect(service.retryAllowances(12345)).rejects.toMatchObject({
      name: 'RateLimitError',
      status: 429,
      data: { retryAfterSeconds: 42 },
    });
    await expect(service.retryAllowances(67890)).rejects.toMatchObject({
      name: 'APIError',
      status: 409,
    });
  });

  it('rejects invalid profileId before network', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({
        tokenId: 'token-1',
        secret: 'secret-1',
      }),
      get: vi.fn(),
      post: vi.fn(),
    } as unknown as HttpClient;

    const service = new PartnerAccountService(httpClient);

    await expect(service.checkAllowances(0)).rejects.toThrow(
      'profileId must be a positive integer'
    );
    await expect(service.retryAllowances(-1)).rejects.toThrow(
      'profileId must be a positive integer'
    );

    expect((httpClient as any).get).not.toHaveBeenCalled();
    expect((httpClient as any).post).not.toHaveBeenCalled();
  });

  it('rejects legacy apiKey-only auth for allowance recovery before hitting the API', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue(undefined),
      get: vi.fn(),
      post: vi.fn(),
    } as unknown as HttpClient;

    const service = new PartnerAccountService(httpClient);

    await expect(service.checkAllowances(12345)).rejects.toThrow(
      'Partner account allowance recovery requires HMAC-scoped API token auth; legacy API keys are not supported.'
    );
    await expect(service.retryAllowances(12345)).rejects.toThrow(
      'Partner account allowance recovery requires HMAC-scoped API token auth; legacy API keys are not supported.'
    );

    expect((httpClient as any).get).not.toHaveBeenCalled();
    expect((httpClient as any).post).not.toHaveBeenCalled();
  });
});
