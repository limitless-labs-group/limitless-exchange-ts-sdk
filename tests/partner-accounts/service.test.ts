import { describe, expect, it, vi } from 'vitest';
import { PartnerAccountService } from '../../src/partner-accounts/service';
import type { HttpClient } from '../../src/api/http';

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
      undefined,
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
      }),
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
      },
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
      },
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
      }),
    ).rejects.toThrow('displayName must be at most 44 characters');
  });
});
