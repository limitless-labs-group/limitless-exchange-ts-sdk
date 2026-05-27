import type { ReceiveWindowOptions } from '../types/orders';

const MAX_RECV_WINDOW_MS = 10_000;

/**
 * Validates and normalizes optional order receive-window controls.
 *
 * These fields are request-level controls for POST /orders. They are not part
 * of the EIP-712 signed order payload.
 *
 * @public
 */
export function normalizeReceiveWindowOptions(
  options: ReceiveWindowOptions,
  now: () => number = Date.now
): ReceiveWindowOptions {
  const { timestamp, recvWindow } = options;

  if (timestamp !== undefined && (!Number.isInteger(timestamp) || timestamp < 0)) {
    throw new Error('timestamp must be a non-negative integer');
  }

  if (recvWindow !== undefined) {
    if (!Number.isInteger(recvWindow)) {
      throw new Error('recvWindow must be an integer');
    }
    if (recvWindow < 1 || recvWindow > MAX_RECV_WINDOW_MS) {
      throw new Error(`recvWindow must be between 1 and ${MAX_RECV_WINDOW_MS} milliseconds`);
    }
  }

  if (timestamp === undefined && recvWindow === undefined) {
    return {};
  }

  const normalized: ReceiveWindowOptions = {};
  if (timestamp !== undefined) {
    normalized.timestamp = timestamp;
  }
  if (recvWindow !== undefined) {
    normalized.recvWindow = recvWindow;
    normalized.timestamp ??= now();
  }

  return normalized;
}
