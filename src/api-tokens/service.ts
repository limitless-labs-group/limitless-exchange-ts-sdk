import { HttpClient } from '../api/http';
import {
  SdkResponse,
  type ResponseOptions,
  type WithRawResponseOptions,
  type WithoutRawResponseOptions,
} from '../api/response';
import type {
  ApiToken,
  ApiTokenMessageResponse,
  DeriveApiTokenInput,
  DeriveApiTokenResponse,
  PartnerCapabilities,
} from '../types/api-tokens';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * Partner self-service API-token operations.
 * @public
 */
export class ApiTokenService {
  private readonly httpClient: HttpClient;
  private readonly logger: ILogger;

  constructor(httpClient: HttpClient, logger?: ILogger) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
  }

  async deriveToken(
    identityToken: string,
    input: DeriveApiTokenInput,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<DeriveApiTokenResponse>>;
  async deriveToken(
    identityToken: string,
    input: DeriveApiTokenInput,
    options?: WithoutRawResponseOptions
  ): Promise<DeriveApiTokenResponse>;
  async deriveToken(
    identityToken: string,
    input: DeriveApiTokenInput,
    options: ResponseOptions
  ): Promise<DeriveApiTokenResponse | SdkResponse<DeriveApiTokenResponse>>;
  async deriveToken(
    identityToken: string,
    input: DeriveApiTokenInput,
    options: ResponseOptions = {}
  ): Promise<DeriveApiTokenResponse | SdkResponse<DeriveApiTokenResponse>> {
    if (!identityToken) {
      throw new Error('Identity token is required for deriveToken');
    }

    this.logger.debug('Deriving API token', { scopes: input.scopes, label: input.label });
    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.postWithIdentity<DeriveApiTokenResponse>(
        '/auth/api-tokens/derive',
        identityToken,
        input,
        { withRawResponse: true }
      );
      return new SdkResponse(rawResponse.data, rawResponse);
    }
    return this.httpClient.postWithIdentity<DeriveApiTokenResponse>(
      '/auth/api-tokens/derive',
      identityToken,
      input
    );
  }

  async listTokens(options: WithRawResponseOptions): Promise<SdkResponse<ApiToken[]>>;
  async listTokens(options?: WithoutRawResponseOptions): Promise<ApiToken[]>;
  async listTokens(options: ResponseOptions): Promise<ApiToken[] | SdkResponse<ApiToken[]>>;
  async listTokens(options: ResponseOptions = {}): Promise<ApiToken[] | SdkResponse<ApiToken[]>> {
    this.httpClient.requireAuth('listTokens');
    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.get<ApiToken[]>('/auth/api-tokens', {
        withRawResponse: true,
      });
      return new SdkResponse(rawResponse.data, rawResponse);
    }
    return this.httpClient.get<ApiToken[]>('/auth/api-tokens');
  }

  async getCapabilities(
    identityToken: string,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<PartnerCapabilities>>;
  async getCapabilities(
    identityToken: string,
    options?: WithoutRawResponseOptions
  ): Promise<PartnerCapabilities>;
  async getCapabilities(
    identityToken: string,
    options: ResponseOptions
  ): Promise<PartnerCapabilities | SdkResponse<PartnerCapabilities>>;
  async getCapabilities(
    identityToken: string,
    options: ResponseOptions = {}
  ): Promise<PartnerCapabilities | SdkResponse<PartnerCapabilities>> {
    if (!identityToken) {
      throw new Error('Identity token is required for getCapabilities');
    }

    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.getWithIdentity<PartnerCapabilities>(
        '/auth/api-tokens/capabilities',
        identityToken,
        { withRawResponse: true }
      );
      return new SdkResponse(rawResponse.data, rawResponse);
    }
    return this.httpClient.getWithIdentity<PartnerCapabilities>(
      '/auth/api-tokens/capabilities',
      identityToken
    );
  }

  async revokeToken(
    tokenId: string,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<string, ApiTokenMessageResponse>>;
  async revokeToken(tokenId: string, options?: WithoutRawResponseOptions): Promise<string>;
  async revokeToken(
    tokenId: string,
    options: ResponseOptions
  ): Promise<string | SdkResponse<string, ApiTokenMessageResponse>>;
  async revokeToken(
    tokenId: string,
    options: ResponseOptions = {}
  ): Promise<string | SdkResponse<string, ApiTokenMessageResponse>> {
    this.httpClient.requireAuth('revokeToken');
    const endpoint = `/auth/api-tokens/${encodeURIComponent(tokenId)}`;
    if (options.withRawResponse) {
      const rawResponse = await this.httpClient.delete<ApiTokenMessageResponse>(endpoint, {
        withRawResponse: true,
      });
      return new SdkResponse(rawResponse.data.message, rawResponse);
    }
    const response = await this.httpClient.delete<ApiTokenMessageResponse>(endpoint);
    return response.message;
  }
}
