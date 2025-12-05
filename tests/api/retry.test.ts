import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RetryConfig,
  withRetry,
  retryOnErrors,
  RetryableClient,
} from '../../src/api/retry';
import { APIError } from '../../src/api/errors';
import { HttpClient } from '../../src/api/http';
import { NoOpLogger } from '../../src/types/logger';

describe('RetryConfig', () => {
  it('should create config with default values', () => {
    const config = new RetryConfig();

    expect(config.statusCodes).toEqual(new Set([429, 500, 502, 503, 504]));
    expect(config.maxRetries).toBe(3);
    expect(config.delays).toBeUndefined();
    expect(config.exponentialBase).toBe(2);
    expect(config.maxDelay).toBe(60);
  });

  it('should create config with custom values', () => {
    const config = new RetryConfig({
      statusCodes: [429, 500],
      maxRetries: 5,
      delays: [1, 2, 4],
      exponentialBase: 3,
      maxDelay: 30,
    });

    expect(config.statusCodes).toEqual(new Set([429, 500]));
    expect(config.maxRetries).toBe(5);
    expect(config.delays).toEqual([1, 2, 4]);
    expect(config.exponentialBase).toBe(3);
    expect(config.maxDelay).toBe(30);
  });

  describe('getDelay', () => {
    it('should use specified delays when provided', () => {
      const config = new RetryConfig({
        delays: [2, 5, 10],
      });

      expect(config.getDelay(0)).toBe(2);
      expect(config.getDelay(1)).toBe(5);
      expect(config.getDelay(2)).toBe(10);
      expect(config.getDelay(3)).toBe(10); // Uses last delay
    });

    it('should calculate exponential backoff when no delays provided', () => {
      const config = new RetryConfig({
        exponentialBase: 2,
        maxDelay: 30,
      });

      expect(config.getDelay(0)).toBe(1); // 2^0
      expect(config.getDelay(1)).toBe(2); // 2^1
      expect(config.getDelay(2)).toBe(4); // 2^2
      expect(config.getDelay(3)).toBe(8); // 2^3
      expect(config.getDelay(4)).toBe(16); // 2^4
      expect(config.getDelay(5)).toBe(30); // Capped at maxDelay
    });

    it('should respect maxDelay cap', () => {
      const config = new RetryConfig({
        exponentialBase: 2,
        maxDelay: 10,
      });

      expect(config.getDelay(10)).toBe(10); // Would be 1024, capped at 10
    });
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(mockFn, { maxRetries: 3 }, new NoOpLogger());

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on APIError with matching status code', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new APIError('Rate limited', 429, {}, '/test', 'GET'))
      .mockRejectedValueOnce(new APIError('Rate limited', 429, {}, '/test', 'GET'))
      .mockResolvedValue('success');

    const logger = new NoOpLogger();
    const promise = withRetry(
      mockFn,
      { statusCodes: [429], maxRetries: 3, delays: [0, 0, 0] },
      logger
    );

    // Fast-forward through delays
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should not retry on non-matching status code', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValue(new APIError('Not found', 404, {}, '/test', 'GET'));

    await expect(
      withRetry(mockFn, { statusCodes: [429], maxRetries: 3 }, new NoOpLogger())
    ).rejects.toThrow('Not found');

    expect(mockFn).toHaveBeenCalledTimes(1); // No retries
  });

  it('should not retry on non-APIError', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Generic error'));

    await expect(
      withRetry(mockFn, { maxRetries: 3 }, new NoOpLogger())
    ).rejects.toThrow('Generic error');

    expect(mockFn).toHaveBeenCalledTimes(1); // No retries
  });

  it('should exhaust retries and throw last error', async () => {
    const error = new APIError('Server error', 500, {}, '/test', 'GET');
    const mockFn = vi.fn().mockRejectedValue(error);

    // Start the promise and immediately wrap in expect to catch rejection
    const expectation = expect(
      withRetry(
        mockFn,
        { statusCodes: [500], maxRetries: 2, delays: [0, 0] },
        new NoOpLogger()
      )
    ).rejects.toThrow('Server error');

    // Now advance timers
    await vi.runAllTimersAsync();

    // Wait for assertion
    await expectation;
    expect(mockFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should call onRetry callback before each retry', async () => {
    const onRetry = vi.fn();
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new APIError('Rate limited', 429, {}, '/test', 'GET'))
      .mockResolvedValue('success');

    const promise = withRetry(
      mockFn,
      {
        statusCodes: [429],
        maxRetries: 3,
        delays: [0],
        onRetry,
      },
      new NoOpLogger()
    );

    await vi.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      0,
      expect.any(APIError),
      0 // delay
    );
  });

  it('should use exponential backoff when no delays provided', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new APIError('Server error', 500, {}, '/test', 'GET'))
      .mockRejectedValueOnce(new APIError('Server error', 500, {}, '/test', 'GET'))
      .mockResolvedValue('success');

    const onRetry = vi.fn();
    const promise = withRetry(
      mockFn,
      {
        statusCodes: [500],
        maxRetries: 3,
        exponentialBase: 2,
        maxDelay: 60,
        onRetry,
      },
      new NoOpLogger()
    );

    await vi.runAllTimersAsync();
    await promise;

    // Check that exponential delays were used
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 0, expect.any(APIError), 1); // 2^0
    expect(onRetry).toHaveBeenNthCalledWith(2, 1, expect.any(APIError), 2); // 2^1
  });
});

describe('retryOnErrors decorator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should apply decorator and retry on matching error', async () => {
    // Manually apply decorator to test its behavior
    const config = {
      statusCodes: [429],
      maxRetries: 2,
      delays: [0, 0],
    };

    let callCount = 0;
    const originalMethod = async function (): Promise<string> {
      callCount++;
      if (callCount < 3) {
        throw new APIError('Rate limited', 429, {}, '/test', 'GET');
      }
      return 'success';
    };

    // Apply decorator manually
    const decorator = retryOnErrors(config);
    const descriptor = { value: originalMethod };
    const decoratedDescriptor = decorator({}, 'testMethod', descriptor);
    const decoratedMethod = decoratedDescriptor.value;

    const promise = decoratedMethod();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(callCount).toBe(3); // 1 initial + 2 retries
  });

  it('should not retry on non-matching error with decorator', async () => {
    const config = {
      statusCodes: [429],
      maxRetries: 3,
    };

    const originalMethod = async function (): Promise<string> {
      throw new APIError('Not found', 404, {}, '/test', 'GET');
    };

    // Apply decorator manually
    const decorator = retryOnErrors(config);
    const descriptor = { value: originalMethod };
    const decoratedDescriptor = decorator({}, 'testMethod', descriptor);
    const decoratedMethod = decoratedDescriptor.value;

    await expect(decoratedMethod()).rejects.toThrow('Not found');
  });

  it('should preserve method context with decorator', async () => {
    const config = {
      statusCodes: [500],
      maxRetries: 2,
      delays: [0, 0],
    };

    const context = {
      value: 'test-value',
      callCount: 0,
    };

    const originalMethod = async function (this: typeof context): Promise<string> {
      this.callCount++;
      if (this.callCount < 2) {
        throw new APIError('Server error', 500, {}, '/test', 'GET');
      }
      return this.value;
    };

    // Apply decorator manually
    const decorator = retryOnErrors(config);
    const descriptor = { value: originalMethod };
    const decoratedDescriptor = decorator({}, 'testMethod', descriptor);
    const decoratedMethod = decoratedDescriptor.value;

    const promise = decoratedMethod.call(context);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('test-value');
    expect(context.callCount).toBe(2); // 1 initial + 1 retry
  });

  // Note: The @ decorator syntax works in production code (see examples/06-retry-handling.ts)
  // but requires special test setup. The tests above verify the decorator functionality
  // by manually applying it, which is equivalent to the @ syntax behavior.
});

describe('RetryableClient', () => {
  let mockHttpClient: any;
  let retryConfig: RetryConfig;
  let retryableClient: RetryableClient;

  beforeEach(() => {
    vi.useFakeTimers();

    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };

    retryConfig = new RetryConfig({
      statusCodes: [429, 500],
      maxRetries: 2,
      delays: [0, 0],
    });

    retryableClient = new RetryableClient(mockHttpClient, retryConfig, new NoOpLogger());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('get', () => {
    it('should succeed on first attempt', async () => {
      mockHttpClient.get.mockResolvedValue({ data: 'success' });

      const result = await retryableClient.get('/test');

      expect(result).toEqual({ data: 'success' });
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it('should retry on matching error and succeed', async () => {
      mockHttpClient.get
        .mockRejectedValueOnce(new APIError('Rate limited', 429, {}, '/test', 'GET'))
        .mockResolvedValue({ data: 'success' });

      const promise = retryableClient.get('/test');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ data: 'success' });
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries and throw', async () => {
      const error = new APIError('Server error', 500, {}, '/test', 'GET');
      mockHttpClient.get.mockRejectedValue(error);

      // Start the promise and immediately wrap in expect to catch rejection
      const expectation = expect(
        retryableClient.get('/test')
      ).rejects.toThrow('Server error');

      // Now advance timers
      await vi.runAllTimersAsync();

      // Wait for assertion
      await expectation;
      expect(mockHttpClient.get).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should not retry on non-matching error', async () => {
      mockHttpClient.get.mockRejectedValue(
        new APIError('Not found', 404, {}, '/test', 'GET')
      );

      await expect(retryableClient.get('/test')).rejects.toThrow('Not found');
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it('should forward config parameter', async () => {
      mockHttpClient.get.mockResolvedValue({ data: 'success' });

      await retryableClient.get('/test', { params: { limit: 10 } });

      expect(mockHttpClient.get).toHaveBeenCalledWith('/test', { params: { limit: 10 } });
    });
  });

  describe('post', () => {
    it('should succeed on first attempt', async () => {
      mockHttpClient.post.mockResolvedValue({ id: 123 });

      const result = await retryableClient.post('/orders', { price: 0.5 });

      expect(result).toEqual({ id: 123 });
      expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.post).toHaveBeenCalledWith('/orders', { price: 0.5 }, undefined);
    });

    it('should retry on matching error', async () => {
      mockHttpClient.post
        .mockRejectedValueOnce(new APIError('Rate limited', 429, {}, '/orders', 'POST'))
        .mockResolvedValue({ id: 123 });

      const promise = retryableClient.post('/orders', { price: 0.5 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ id: 123 });
      expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('delete', () => {
    it('should succeed on first attempt', async () => {
      mockHttpClient.delete.mockResolvedValue({ message: 'Deleted' });

      const result = await retryableClient.delete('/orders/123');

      expect(result).toEqual({ message: 'Deleted' });
      expect(mockHttpClient.delete).toHaveBeenCalledTimes(1);
    });

    it('should retry on matching error', async () => {
      mockHttpClient.delete
        .mockRejectedValueOnce(new APIError('Server error', 500, {}, '/orders/123', 'DELETE'))
        .mockResolvedValue({ message: 'Deleted' });

      const promise = retryableClient.delete('/orders/123');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ message: 'Deleted' });
      expect(mockHttpClient.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration with HttpClient', () => {
    it('should work with real HttpClient instance', async () => {
      const httpClient = new HttpClient({ baseURL: 'https://api.example.com' });
      const getSpy = vi.spyOn(httpClient, 'get');

      getSpy
        .mockRejectedValueOnce(new APIError('Rate limited', 429, {}, '/test', 'GET'))
        .mockResolvedValue({ data: 'success' });

      const retryConfig = new RetryConfig({
        statusCodes: [429],
        maxRetries: 2,
        delays: [0, 0],
      });

      const retryableClient = new RetryableClient(httpClient, retryConfig);

      const promise = retryableClient.get('/test');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ data: 'success' });
      expect(getSpy).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Retry mechanism edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should handle zero retries (no retry)', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValue(new APIError('Rate limited', 429, {}, '/test', 'GET'));

    await expect(
      withRetry(mockFn, { statusCodes: [429], maxRetries: 0 }, new NoOpLogger())
    ).rejects.toThrow('Rate limited');

    expect(mockFn).toHaveBeenCalledTimes(1); // Only initial attempt
  });

  it('should handle empty status codes set', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValue(new APIError('Rate limited', 429, {}, '/test', 'GET'));

    await expect(
      withRetry(mockFn, { statusCodes: [], maxRetries: 3 }, new NoOpLogger())
    ).rejects.toThrow('Rate limited');

    expect(mockFn).toHaveBeenCalledTimes(1); // No retry since no matching status
  });

  it('should handle very large delay values', async () => {
    const config = new RetryConfig({
      exponentialBase: 10,
      maxDelay: 1000,
    });

    expect(config.getDelay(5)).toBe(1000); // 10^5 = 100000, capped at 1000
  });

  it('should handle callback throwing error', async () => {
    const onRetry = vi.fn().mockImplementation(() => {
      throw new Error('Callback error');
    });

    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new APIError('Rate limited', 429, {}, '/test', 'GET'))
      .mockResolvedValue('success');

    const promise = withRetry(
      mockFn,
      {
        statusCodes: [429],
        maxRetries: 3,
        delays: [0],
        onRetry,
      },
      new NoOpLogger()
    );

    // Advance timers in background
    vi.runAllTimersAsync();

    // Callback error should propagate
    await expect(promise).rejects.toThrow('Callback error');
  });

  it('should handle multiple status codes', async () => {
    const config = new RetryConfig({
      statusCodes: [429, 500, 502, 503, 504],
    });

    expect(config.statusCodes.has(429)).toBe(true);
    expect(config.statusCodes.has(500)).toBe(true);
    expect(config.statusCodes.has(502)).toBe(true);
    expect(config.statusCodes.has(503)).toBe(true);
    expect(config.statusCodes.has(504)).toBe(true);
    expect(config.statusCodes.has(404)).toBe(false);
  });
});
