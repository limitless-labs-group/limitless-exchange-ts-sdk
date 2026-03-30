import { describe, expect, it } from 'vitest';
import { HttpClient } from '../../src/api/http';
import { computeHMACSignature } from '../../src/api/hmac';

function normalizeHeaders(headers: any): Record<string, string> {
  if (typeof headers?.toJSON === 'function') {
    return headers.toJSON();
  }

  return headers || {};
}

describe('HttpClient HMAC auth', () => {
  it('injects HMAC headers and suppresses X-API-Key when HMAC is configured', async () => {
    const secret = Buffer.from('test-secret').toString('base64');
    const client = new HttpClient({
      baseURL: 'https://api.limitless.exchange',
      apiKey: 'api-key-value',
      hmacCredentials: {
        tokenId: 'token-1',
        secret,
      },
    });

    let capturedConfig: any;
    (client as any).client.defaults.adapter = async (config: any) => {
      capturedConfig = config;
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await client.patch('/orders?market=btc', { foo: 'bar' });

    const headers = normalizeHeaders(capturedConfig.headers);
    expect(headers['X-API-Key']).toBeUndefined();
    expect(headers['lmts-api-key']).toBe('token-1');
    expect(headers['lmts-timestamp']).toBeTruthy();
    expect(headers['lmts-signature']).toBe(
      computeHMACSignature(secret, headers['lmts-timestamp'], 'PATCH', '/orders?market=btc', '{"foo":"bar"}'),
    );
  });

  it('uses identity auth per request and suppresses API-key and HMAC headers', async () => {
    const secret = Buffer.from('test-secret').toString('base64');
    const client = new HttpClient({
      baseURL: 'https://api.limitless.exchange',
      apiKey: 'api-key-value',
      hmacCredentials: {
        tokenId: 'token-1',
        secret,
      },
    });

    let capturedConfig: any;
    (client as any).client.defaults.adapter = async (config: any) => {
      capturedConfig = config;
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await client.postWithIdentity('/auth/api-tokens/derive', 'identity-token', { scopes: ['trading'] });

    const headers = normalizeHeaders(capturedConfig.headers);
    expect(headers.identity).toBe('Bearer identity-token');
    expect(headers['X-API-Key']).toBeUndefined();
    expect(headers['lmts-api-key']).toBeUndefined();
    expect(headers['lmts-timestamp']).toBeUndefined();
    expect(headers['lmts-signature']).toBeUndefined();
  });
});
