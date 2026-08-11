import { describe, expect, it } from 'vitest';
import { SdkResponse } from '../../src/api/response';

describe('SdkResponse', () => {
  it('keeps the transformed SDK value separate from the original HTTP response', () => {
    const rawResponse = {
      status: 201,
      headers: { 'x-request-id': 'request-1' },
      data: { amount: '1000000', extraServerField: true },
    };
    const transformed = { amount: 1 };

    const response = new SdkResponse(transformed, rawResponse);

    expect(response.data).toBe(transformed);
    expect(response.getRaw()).toBe(rawResponse);
    expect(response.getRaw().data.extraServerField).toBe(true);
    expect(Object.keys(response)).toEqual(['data']);
  });
});
