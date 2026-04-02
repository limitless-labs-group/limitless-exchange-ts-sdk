import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../../src/api/http';
import { APIError } from '../../src/api/errors';

describe('HttpClient.getRaw', () => {
  it('sets SDK tracking headers by default', () => {
    const client = new HttpClient({ baseURL: 'https://api.limitless.exchange' });
    const headersJson = JSON.stringify((client as any).client.defaults.headers).toLowerCase();

    expect(headersJson).toContain('x-sdk-version');
    expect(headersJson).toContain('lmts-sdk-ts/');
  });

  it('throws typed APIError for 4xx even if validateStatus allows it', async () => {
    const client = new HttpClient({ baseURL: 'https://api.limitless.exchange' });

    (client as any).client = {
      get: vi.fn().mockResolvedValue({
        status: 404,
        headers: {},
        data: { message: 'not found' },
      }),
    };

    await expect(
      client.getRaw('/missing', {
        validateStatus: () => true,
      })
    ).rejects.toBeInstanceOf(APIError);
  });

  it('returns raw response for accepted non-error status (e.g. 301)', async () => {
    const client = new HttpClient({ baseURL: 'https://api.limitless.exchange' });

    (client as any).client = {
      get: vi.fn().mockResolvedValue({
        status: 301,
        headers: { location: '/crypto' },
        data: null,
      }),
    };

    const response = await client.getRaw('/market-pages/by-path?path=/old', {
      validateStatus: (status) => status === 200 || status === 301,
      maxRedirects: 0,
    });

    expect(response.status).toBe(301);
    expect((response.headers as any).location).toBe('/crypto');
  });

  it('injects X-API-Key when API-key auth is configured without HMAC', async () => {
    const client = new HttpClient({
      baseURL: 'https://api.limitless.exchange',
      apiKey: 'api-key-value',
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

    await client.post('/orders', { foo: 'bar' });

    const headers = typeof capturedConfig.headers?.toJSON === 'function'
      ? capturedConfig.headers.toJSON()
      : capturedConfig.headers;

    expect(headers['X-API-Key']).toBe('api-key-value');
    expect(headers['lmts-api-key']).toBeUndefined();
    expect(headers['lmts-timestamp']).toBeUndefined();
    expect(headers['lmts-signature']).toBeUndefined();
  });

  it('treats cookie auth in additional headers as authenticated transport', () => {
    const client = new HttpClient({
      baseURL: 'https://api.limitless.exchange',
      additionalHeaders: {
        Cookie: 'limitless_session=test-cookie',
      },
    });

    expect(() => client.requireAuth('adminOperation')).not.toThrow();
  });
});
