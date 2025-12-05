import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { Authenticator } from '../../src/auth/authenticator';
import { MessageSigner } from '../../src/auth/signer';
import { HttpClient } from '../../src/api/http';

vi.mock('../../src/api/http');

describe('Authenticator', () => {
  let authenticator: Authenticator;
  let httpClient: HttpClient;
  let signer: MessageSigner;
  let wallet: ethers.Wallet;

  beforeEach(() => {
    wallet = ethers.Wallet.createRandom();
    signer = new MessageSigner(wallet);
    httpClient = new HttpClient();
    authenticator = new Authenticator(httpClient, signer);
  });

  describe('getSigningMessage', () => {
    it('should retrieve signing message from API', async () => {
      const mockMessage = 'Welcome to Limitless.exchange! Nonce: 0x123';

      vi.spyOn(httpClient, 'get').mockResolvedValue(mockMessage);

      const message = await authenticator.getSigningMessage();

      expect(message).toBe(mockMessage);
      expect(httpClient.get).toHaveBeenCalledWith('/auth/signing-message');
    });
  });

  describe('authenticate', () => {
    it('should authenticate with EOA client', async () => {
      const mockMessage = 'Welcome to Limitless.exchange! Nonce: 0x123';
      const mockProfile = {
        account: wallet.address,
        displayName: wallet.address,
        client: 'eoa' as const,
      };

      vi.spyOn(httpClient, 'get').mockResolvedValue(mockMessage);
      vi.spyOn(httpClient, 'postWithResponse').mockImplementation(async () => {
        const mockResponse: any = {
          data: mockProfile,
          headers: {
            'set-cookie': ['limitless_session=test-jwt-token; HttpOnly; Path=/'],
          },
        };
        return mockResponse;
      });
      vi.spyOn(httpClient, 'extractCookies').mockReturnValue({
        'limitless_session': 'test-jwt-token',
      });

      const result = await authenticator.authenticate({ client: 'eoa' });

      expect(result.sessionCookie).toBe('test-jwt-token');
      expect(result.profile.account).toBe(wallet.address);
    });

    it('should throw error when smart wallet is required but not provided', async () => {
      await expect(
        authenticator.authenticate({ client: 'etherspot' })
      ).rejects.toThrow('Smart wallet address is required for ETHERSPOT client');
    });

    it('should authenticate with ETHERSPOT and smart wallet', async () => {
      const mockMessage = 'Welcome to Limitless.exchange! Nonce: 0x123';
      const smartWallet = '0x1234567890123456789012345678901234567890';
      const mockProfile = {
        account: wallet.address,
        displayName: wallet.address,
        smartWallet,
        client: 'etherspot' as const,
      };

      vi.spyOn(httpClient, 'get').mockResolvedValue(mockMessage);
      vi.spyOn(httpClient, 'postWithResponse').mockImplementation(async () => {
        const mockResponse: any = {
          data: mockProfile,
          headers: {
            'set-cookie': ['limitless_session=test-jwt-token; HttpOnly; Path=/'],
          },
        };
        return mockResponse;
      });
      vi.spyOn(httpClient, 'extractCookies').mockReturnValue({
        'limitless_session': 'test-jwt-token',
      });

      const result = await authenticator.authenticate({
        client: 'etherspot',
        smartWallet,
      });

      expect(result.profile.smartWallet).toBe(smartWallet);
    });
  });

  describe('verifyAuth', () => {
    it('should verify authentication and return address', async () => {
      const mockAddress = wallet.address;

      vi.spyOn(httpClient, 'get').mockResolvedValue(mockAddress);

      const address = await authenticator.verifyAuth('test-jwt-token');

      expect(address).toBe(mockAddress);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      vi.spyOn(httpClient, 'post').mockResolvedValue(undefined);

      await expect(
        authenticator.logout('test-jwt-token')
      ).resolves.not.toThrow();

      expect(httpClient.post).toHaveBeenCalledWith('/auth/logout');
    });
  });
});
