import { describe, expect, it } from 'vitest';
import type {
  OmeExecutionOrderEvent,
  OmeLifecycleOrderEvent,
  OmeOrderEvent,
  OrderEvent,
} from '../../src/types/websocket';

// Zero-fill FAK as observed on production, 2026-09-25.
const killed = {
  source: 'OME',
  type: 'EXECUTION',
  status: 'KILLED',
  eventId: 'terminal:821277de-1b92-4b37-bba3-34ff3d26a79e',
  orderId: '821277de-1b92-4b37-bba3-34ff3d26a79e',
  userId: 42,
  marketId: '409786',
  token: '73663029485913087603',
  side: 'BUY',
  price: '0.01',
  remainingSize: '50000000',
  timestamp: '2026-09-25T13:55:55.098321+00:00',
  occurredAt: '2026-09-25T13:55:55.100Z',
  publishedAt: '2026-09-25T13:55:55.106Z',
} satisfies OmeExecutionOrderEvent;

const placement = {
  source: 'OME',
  type: 'PLACEMENT',
  eventId: 1234567,
  orderId: 'c8862535-0000-0000-0000-000000000000',
  clientOrderId: 'client-order-001',
  userId: 42,
  marketId: '409786',
  token: '73663029485913087603',
  side: 'BUY',
  price: 0.53,
  remainingSize: 50000000,
  timestamp: '2026-09-25T13:55:50.000Z',
  occurredAt: '2026-09-25T13:55:50.000Z',
  publishedAt: '2026-09-25T13:55:50.042Z',
} satisfies OmeLifecycleOrderEvent;

/** Narrowing on `type` yields a string on EXECUTION and a number on lifecycle frames. */
function remainingShares(event: OmeOrderEvent): number {
  if (event.type === 'EXECUTION') {
    return Number(event.remainingSize) / 1_000_000;
  }
  return event.remainingSize / 1_000_000;
}

describe('OME order event types', () => {
  it('narrows the EXECUTION terminal frame to string fields', () => {
    const event: OmeOrderEvent = killed;
    expect(remainingShares(event)).toBe(50);
    expect(typeof event.price).toBe('string');
    expect(event.status).toBe('KILLED');
    expect(event.clientOrderId).toBeUndefined();
  });

  it('keeps lifecycle frames numeric', () => {
    const event: OmeOrderEvent = placement;
    expect(remainingShares(event)).toBe(50);
    expect(typeof event.price).toBe('number');
    expect(event.status).toBeUndefined();
  });

  it('remains a member of OrderEvent', () => {
    const events: OrderEvent[] = [killed, placement];
    expect(events.map((e) => e.source)).toEqual(['OME', 'OME']);
  });
});
