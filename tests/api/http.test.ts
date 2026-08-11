import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../../src/api/http';
import {
  APIError,
  ConflictError,
  TooEarlyError,
  UnprocessableEntityError,
  UpstreamUnavailableError,
} from '../../src/api/errors';

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

  it.each([
    [409, ConflictError],
    [422, UnprocessableEntityError],
    [425, TooEarlyError],
    [502, UpstreamUnavailableError],
    [503, UpstreamUnavailableError],
  ])('maps status %s to its typed error', async (status, ErrorType) => {
    const client = new HttpClient({ baseURL: 'https://api.limitless.exchange' });

    (client as any).client = {
      get: vi.fn().mockResolvedValue({
        status,
        headers: {},
        data: { message: `error ${status}` },
      }),
    };

    await expect(
      client.getRaw('/amm/buy', { validateStatus: () => true })
    ).rejects.toBeInstanceOf(ErrorType);
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

    const headers =
      typeof capturedConfig.headers?.toJSON === 'function'
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

  it('returns raw responses for every supported HTTP request variant', async () => {
    const client = new HttpClient({ baseURL: 'https://api.limitless.exchange' });
    const capturedConfigs: any[] = [];

    (client as any).client.defaults.adapter = async (config: any) => {
      capturedConfigs.push(config);
      return {
        data: { method: config.method, url: config.url },
        status: 200,
        statusText: 'OK',
        headers: { 'x-request-id': `request-${capturedConfigs.length}` },
        config,
      };
    };

    const responses = await Promise.all([
      client.get('/get', { withRawResponse: true }),
      client.getWithIdentity('/get-identity', 'identity-token', { withRawResponse: true }),
      client.post('/post', { value: 1 }, { withRawResponse: true }),
      client.postWithIdentity(
        '/post-identity',
        'identity-token',
        { value: 2 },
        { withRawResponse: true }
      ),
      client.postWithHeaders(
        '/post-headers',
        { value: 3 },
        { 'x-extra': 'yes' },
        { withRawResponse: true }
      ),
      client.patch('/patch', { value: 4 }, { withRawResponse: true }),
      client.delete('/delete', { withRawResponse: true }),
      client.deleteWithIdentity('/delete-identity', 'identity-token', { withRawResponse: true }),
    ]);

    expect(responses.map((response) => response.status)).toEqual(Array(8).fill(200));
    expect(responses.map((response) => response.data.method)).toEqual([
      'get',
      'get',
      'post',
      'post',
      'post',
      'patch',
      'delete',
      'delete',
    ]);
    expect(responses[0].getRaw).toBeUndefined();
    expect(capturedConfigs.every((config) => config.withRawResponse === undefined)).toBe(true);
    expect(capturedConfigs[4].headers.get('x-extra')).toBe('yes');
    expect(capturedConfigs[1].headers.get('identity')).toBe('Bearer identity-token');
    expect(capturedConfigs[7].headers.get('identity')).toBe('Bearer identity-token');
  });

  it('keeps the original body-only behavior unless raw mode is explicitly enabled', async () => {
    const client = new HttpClient({ baseURL: 'https://api.limitless.exchange' });

    (client as any).client.defaults.adapter = async (config: any) => ({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: { 'x-request-id': 'request-1' },
      config,
    });

    await expect(client.post('/orders', {})).resolves.toEqual({ ok: true });
    await expect(client.post('/orders', {}, { withRawResponse: false })).resolves.toEqual({
      ok: true,
    });
  });
});
