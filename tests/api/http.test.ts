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
});
