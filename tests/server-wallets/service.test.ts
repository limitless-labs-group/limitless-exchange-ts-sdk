import { describe, expect, it, vi } from 'vitest';
import { ServerWalletService } from '../../src/server-wallets/service';
import type { HttpClient } from '../../src/api/http';

const VALID_CONDITION_ID = `0x${'ab'.repeat(32)}`;
const VALID_ADDRESS = '0x1234567890123456789012345678901234567890';

describe('ServerWalletService', () => {
  it('redeems positions for a delegated server wallet', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({
        tokenId: 'token-1',
        secret: 'secret-1',
      }),
      post: vi.fn().mockResolvedValue({
        hash: '',
        userOperationHash: '0xuserop',
        transactionId: 'tx-1',
        walletAddress: VALID_ADDRESS,
        conditionId: VALID_CONDITION_ID,
        marketId: 42,
      }),
    } as unknown as HttpClient;

    const service = new ServerWalletService(httpClient);
    const response = await service.redeemPositions({
      conditionId: VALID_CONDITION_ID,
      onBehalfOf: 326,
    });

    expect(response.marketId).toBe(42);
    expect((httpClient as any).requireAuth).toHaveBeenCalledWith('redeemServerWalletPositions');
    expect((httpClient as any).post).toHaveBeenCalledWith('/portfolio/redeem', {
      conditionId: VALID_CONDITION_ID,
      onBehalfOf: 326,
    });
  });

  it('withdraws funds and omits undefined optional fields', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({
        tokenId: 'token-1',
        secret: 'secret-1',
      }),
      post: vi.fn().mockResolvedValue({
        hash: '',
        userOperationHash: '0xuserop',
        transactionId: 'tx-2',
        walletAddress: VALID_ADDRESS,
        token: VALID_ADDRESS,
        destination: VALID_ADDRESS,
        amount: '5000000',
      }),
    } as unknown as HttpClient;

    const service = new ServerWalletService(httpClient);
    const response = await service.withdraw({
      amount: '5000000',
      onBehalfOf: 326,
    });

    expect(response.amount).toBe('5000000');
    expect((httpClient as any).requireAuth).toHaveBeenCalledWith('withdrawServerWalletFunds');
    expect((httpClient as any).post).toHaveBeenCalledWith('/portfolio/withdraw', {
      amount: '5000000',
      onBehalfOf: 326,
    });
  });

  it('rejects invalid conditionId before network', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({
        tokenId: 'token-1',
        secret: 'secret-1',
      }),
      post: vi.fn(),
    } as unknown as HttpClient;

    const service = new ServerWalletService(httpClient);

    await expect(
      service.redeemPositions({
        conditionId: '0x1234',
        onBehalfOf: 326,
      }),
    ).rejects.toThrow('conditionId must be a 0x-prefixed 32-byte hex string');

    expect((httpClient as any).post).not.toHaveBeenCalled();
  });

  it('rejects invalid amount before network', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({
        tokenId: 'token-1',
        secret: 'secret-1',
      }),
      post: vi.fn(),
    } as unknown as HttpClient;

    const service = new ServerWalletService(httpClient);

    await expect(
      service.withdraw({
        amount: '0',
        onBehalfOf: 326,
      }),
    ).rejects.toThrow('amount must be a positive integer string in the token smallest unit');

    expect((httpClient as any).post).not.toHaveBeenCalled();
  });

  it('rejects invalid addresses before network', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({
        tokenId: 'token-1',
        secret: 'secret-1',
      }),
      post: vi.fn(),
    } as unknown as HttpClient;

    const service = new ServerWalletService(httpClient);

    await expect(
      service.withdraw({
        amount: '1000000',
        onBehalfOf: 326,
        token: 'not-an-address',
      }),
    ).rejects.toThrow('token must be a valid EVM address');

    await expect(
      service.withdraw({
        amount: '1000000',
        onBehalfOf: 326,
        destination: 'not-an-address',
      }),
    ).rejects.toThrow('destination must be a valid EVM address');

    expect((httpClient as any).post).not.toHaveBeenCalled();
  });

  it('rejects invalid onBehalfOf before network', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue({
        tokenId: 'token-1',
        secret: 'secret-1',
      }),
      post: vi.fn(),
    } as unknown as HttpClient;

    const service = new ServerWalletService(httpClient);

    await expect(
      service.redeemPositions({
        conditionId: VALID_CONDITION_ID,
        onBehalfOf: 0,
      }),
    ).rejects.toThrow('onBehalfOf must be a positive integer');

    expect((httpClient as any).post).not.toHaveBeenCalled();
  });

  it('rejects legacy apiKey-only auth before hitting the API', async () => {
    const httpClient = {
      requireAuth: vi.fn(),
      getHMACCredentials: vi.fn().mockReturnValue(undefined),
      post: vi.fn(),
    } as unknown as HttpClient;

    const service = new ServerWalletService(httpClient);

    await expect(
      service.redeemPositions({
        conditionId: VALID_CONDITION_ID,
        onBehalfOf: 326,
      }),
    ).rejects.toThrow(
      'Server wallet redeem/withdraw require HMAC-scoped API token auth; legacy API keys are not supported.',
    );

    expect((httpClient as any).post).not.toHaveBeenCalled();
  });
});
