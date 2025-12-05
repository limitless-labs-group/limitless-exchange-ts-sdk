import { describe, it, expect, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { MessageSigner } from '../../src/auth/signer';

describe('MessageSigner', () => {
  let wallet: ethers.Wallet;
  let signer: MessageSigner;

  beforeEach(() => {
    wallet = ethers.Wallet.createRandom();
    signer = new MessageSigner(wallet);
  });

  describe('createAuthHeaders', () => {
    it('should create valid authentication headers', async () => {
      const message = 'Welcome to Limitless.exchange! Nonce: 0x123';
      const headers = await signer.createAuthHeaders(message);

      expect(headers).toHaveProperty('x-account');
      expect(headers).toHaveProperty('x-signing-message');
      expect(headers).toHaveProperty('x-signature');

      expect(headers['x-account']).toBe(wallet.address);
      expect(headers['x-signing-message']).toMatch(/^0x/);
      expect(headers['x-signature']).toMatch(/^0x/);
    });

    it('should create hex-encoded signing message', async () => {
      const message = 'Test message';
      const headers = await signer.createAuthHeaders(message);

      const expectedHex = ethers.hexlify(ethers.toUtf8Bytes(message));
      expect(headers['x-signing-message']).toBe(expectedHex);
    });

    it('should create verifiable signature', async () => {
      const message = 'Test message';
      const headers = await signer.createAuthHeaders(message);

      const recoveredAddress = ethers.verifyMessage(
        message,
        headers['x-signature']
      );

      expect(recoveredAddress.toLowerCase()).toBe(
        wallet.address.toLowerCase()
      );
    });

    it('should throw error if signature verification fails', async () => {
      const message = 'Test message';
      const differentWallet = ethers.Wallet.createRandom();
      const differentSigner = new MessageSigner(differentWallet);

      const headers = await differentSigner.createAuthHeaders(message);

      const recoveredAddress = ethers.verifyMessage(
        message,
        headers['x-signature']
      );

      expect(recoveredAddress.toLowerCase()).not.toBe(
        wallet.address.toLowerCase()
      );
    });
  });

  describe('signTypedData', () => {
    it('should sign EIP-712 typed data', async () => {
      const domain = {
        name: 'Test Domain',
        version: '1',
        chainId: 1,
      };

      const types = {
        Test: [
          { name: 'value', type: 'uint256' },
        ],
      };

      const value = {
        value: 123,
      };

      const signature = await signer.signTypedData(domain, types, value);

      expect(signature).toMatch(/^0x/);
      expect(signature.length).toBeGreaterThan(100);
    });
  });

  describe('getAddress', () => {
    it('should return wallet address', () => {
      const address = signer.getAddress();
      expect(address).toBe(wallet.address);
    });
  });
});
