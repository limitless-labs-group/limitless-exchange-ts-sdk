import { describe, expect, it, vi } from 'vitest';
import { ApiTokenService } from '../../src/api-tokens/service';
import type { HttpClient } from '../../src/api/http';

describe('ApiTokenService', () => {
  it('gets partner capabilities with identity auth', async () => {
    const httpClient = {
      getWithIdentity: vi.fn().mockResolvedValue({
        tokenManagementEnabled: true,
        allowedScopes: ['trading', 'delegated_signing'],
      }),
    } as unknown as HttpClient;

    const service = new ApiTokenService(httpClient);
    const response = await service.getCapabilities('identity-token');

    expect(response).toEqual({
      tokenManagementEnabled: true,
      allowedScopes: ['trading', 'delegated_signing'],
    });
    expect((httpClient as any).getWithIdentity).toHaveBeenCalledWith(
      '/auth/api-tokens/capabilities',
      'identity-token',
    );
  });

  it('derives a token with identity auth', async () => {
    const httpClient = {
      postWithIdentity: vi.fn().mockResolvedValue({ tokenId: 'tok-1' }),
    } as unknown as HttpClient;

    const service = new ApiTokenService(httpClient);
    const response = await service.deriveToken('identity-token', {
      label: 'Partner token',
      scopes: ['trading', 'delegated_signing'],
    });

    expect(response).toEqual({ tokenId: 'tok-1' });
    expect((httpClient as any).postWithIdentity).toHaveBeenCalledWith(
      '/auth/api-tokens/derive',
      'identity-token',
      {
        label: 'Partner token',
        scopes: ['trading', 'delegated_signing'],
      },
    );
  });

  it('lists tokens with authenticated transport', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      get: vi.fn().mockResolvedValue([{ tokenId: 'tok-1' }]),
    } as unknown as HttpClient;

    const service = new ApiTokenService(httpClient);
    const tokens = await service.listTokens();

    expect(tokens).toEqual([{ tokenId: 'tok-1' }]);
    expect((httpClient as any).requireAuth).toHaveBeenCalledWith('listTokens');
    expect((httpClient as any).get).toHaveBeenCalledWith('/auth/api-tokens');
  });

  it('revokes a token with authenticated transport', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      delete: vi.fn().mockResolvedValue({ message: 'Token revoked successfully' }),
    } as unknown as HttpClient;

    const service = new ApiTokenService(httpClient);
    const response = await service.revokeToken('tok/with spaces');

    expect(response).toBe('Token revoked successfully');
    expect((httpClient as any).requireAuth).toHaveBeenCalledWith('revokeToken');
    expect((httpClient as any).delete).toHaveBeenCalledWith('/auth/api-tokens/tok%2Fwith%20spaces');
  });
});
