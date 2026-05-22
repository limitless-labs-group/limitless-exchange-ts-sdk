import { describe, expect, it } from 'vitest';
import { ethers } from 'ethers';
import { Client } from '../src/client';
import type { EthersLikeWallet } from '../src/types/wallet';

describe('Client', () => {
  it('composes the new partner/delegated services from shared HTTP config', () => {
    const client = new Client({
      baseURL: 'https://api.limitless.exchange',
      hmacCredentials: {
        tokenId: 'token-1',
        secret: Buffer.from('test-secret').toString('base64'),
      },
    });

    expect(client.http).toBeDefined();
    expect(client.apiTokens).toBeDefined();
    expect(client.partnerAccounts).toBeDefined();
    expect(client.delegatedOrders).toBeDefined();
    expect(client.serverWallets).toBeDefined();
  });

  it('reuses shared services in the derived order client and websocket client', () => {
    const client = new Client({
      baseURL: 'https://api.limitless.exchange',
      hmacCredentials: {
        tokenId: 'token-1',
        secret: Buffer.from('test-secret').toString('base64'),
      },
    });

    const orderClient = client.newOrderClient(
      '0x59c6995e998f97a5a0044966f0945382d7f33b94d8538d9f1fd7055c77a46f6c',
    );
    const wsClient = client.newWebSocketClient();

    expect((orderClient as any).marketFetcher).toBe(client.markets);
    expect((wsClient as any).config.hmacCredentials?.tokenId).toBe('token-1');
  });

  it('newOrderClient accepts an ethers.Wallet instance (regression guard)', () => {
    // Regression guard for the dual-package nominal-type fix: if anyone
    // narrows `EthersLikeWallet | string` back to `ethers.Wallet | string`,
    // downstream consumers whose ethers resolves to a different bundle
    // start failing with `'Wallet' is not assignable to type 'Wallet'`.
    // This test catches the narrowing at compile time (the cast happens in
    // type space, not runtime).
    const client = new Client({ baseURL: 'https://api.limitless.exchange' });
    const wallet = new ethers.Wallet(
      '0x59c6995e998f97a5a0044966f0945382d7f33b94d8538d9f1fd7055c77a46f6c',
    );
    const orderClient = client.newOrderClient(wallet);
    expect(orderClient.walletAddress).toBe(wallet.address);
  });

  it('newOrderClient accepts a custom EthersLikeWallet (non-ethers signer)', () => {
    // Proves the structural-interface contract: any signer with address +
    // getAddress + signTypedData satisfies it. This is the use case that
    // motivated the change (HSM-backed signers, viem bridges, etc.).
    const client = new Client({ baseURL: 'https://api.limitless.exchange' });
    const customSigner: EthersLikeWallet = {
      address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      getAddress: async () => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      signTypedData: async () => '0x' + '00'.repeat(65),
    };
    const orderClient = client.newOrderClient(customSigner);
    expect(orderClient.walletAddress).toBe(customSigner.address);
  });
});
