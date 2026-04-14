import { describe, expect, it } from 'vitest';
import { Client } from '../src/client';

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
});
