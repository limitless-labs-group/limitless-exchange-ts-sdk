import { createHmac } from 'crypto';

/**
 * Builds the canonical HMAC message used by the API-token auth flow.
 * @public
 */
export function buildHMACMessage(timestamp: string, method: string, path: string, body: string): string {
  return `${timestamp}\n${method.toUpperCase()}\n${path}\n${body}`;
}

/**
 * Computes a base64 HMAC-SHA256 request signature from a base64 secret.
 * @public
 */
export function computeHMACSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string,
): string {
  const key = Buffer.from(secret, 'base64');
  return createHmac('sha256', key).update(buildHMACMessage(timestamp, method, path, body)).digest('base64');
}
