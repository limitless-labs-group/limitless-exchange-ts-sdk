import { describe, expect, it } from 'vitest';
import { buildHMACMessage, computeHMACSignature } from '../../src/api/hmac';

describe('HMAC helpers', () => {
  it('builds the canonical HMAC message', () => {
    expect(buildHMACMessage('2026-03-23T12:34:56.789Z', 'post', '/orders?market=btc', '{"foo":"bar"}')).toBe(
      '2026-03-23T12:34:56.789Z\nPOST\n/orders?market=btc\n{"foo":"bar"}',
    );
  });

  it('computes a base64 HMAC signature from the base64 secret', () => {
    const secret = Buffer.from('super-secret-key').toString('base64');
    const signature = computeHMACSignature(
      secret,
      '2026-03-23T12:34:56.789Z',
      'PATCH',
      '/orders?market=btc',
      '{"foo":"bar"}',
    );

    expect(signature).toBe('mgMUpOd7FH4sOSti2MF30YKF9yDq+67VjFksPa5I5eE=');
  });
});
