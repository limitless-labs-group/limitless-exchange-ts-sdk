import type { HttpRawResponse } from './http';

/**
 * Options shared by SDK methods that can expose their underlying HTTP response.
 *
 * @public
 */
export interface ResponseOptions {
  /**
   * When true, return an {@link SdkResponse} containing both the normal SDK value
   * and the unmodified HTTP response body, status, and headers.
   *
   * @defaultValue false
   */
  withRawResponse?: boolean;
}

/**
 * Response options that request raw HTTP response metadata.
 *
 * @public
 */
export interface WithRawResponseOptions extends ResponseOptions {
  withRawResponse: true;
}

/**
 * Response options that keep the SDK's standard return value.
 *
 * @public
 */
export interface WithoutRawResponseOptions extends ResponseOptions {
  withRawResponse?: false;
}

/**
 * Opt-in SDK response containing the normal value and its underlying HTTP response.
 *
 * @typeParam T - Normal value returned by the SDK method
 * @typeParam TRaw - Original response body returned by the API
 *
 * @public
 */
export class SdkResponse<T, TRaw = T> {
  /**
   * The normal value produced by the SDK method, including any SDK transformations.
   */
  public readonly data: T;

  readonly #rawResponse: HttpRawResponse<TRaw>;

  constructor(data: T, rawResponse: HttpRawResponse<TRaw>) {
    this.data = data;
    this.#rawResponse = rawResponse;
  }

  /**
   * Returns the underlying HTTP status, headers, and original response body.
   */
  getRaw(): HttpRawResponse<TRaw> {
    return this.#rawResponse;
  }
}
