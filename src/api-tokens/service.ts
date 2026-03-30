import { HttpClient } from '../api/http';
import type {
  ApiToken,
  DeriveApiTokenInput,
  DeriveApiTokenResponse,
  PartnerCapabilities,
} from '../types/api-tokens';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

interface MessageResponse {
  message: string;
}

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

  async deriveToken(identityToken: string, input: DeriveApiTokenInput): Promise<DeriveApiTokenResponse> {
    if (!identityToken) {
      throw new Error('Identity token is required for deriveToken');
    }

    this.logger.debug('Deriving API token', { scopes: input.scopes, label: input.label });
    return this.httpClient.postWithIdentity<DeriveApiTokenResponse>('/auth/api-tokens/derive', identityToken, input);
  }

  async listTokens(): Promise<ApiToken[]> {
    this.httpClient.requireAuth('listTokens');
    return this.httpClient.get<ApiToken[]>('/auth/api-tokens');
  }

  async getCapabilities(identityToken: string): Promise<PartnerCapabilities> {
    if (!identityToken) {
      throw new Error('Identity token is required for getCapabilities');
    }

    return this.httpClient.getWithIdentity<PartnerCapabilities>('/auth/api-tokens/capabilities', identityToken);
  }

  async revokeToken(tokenId: string): Promise<string> {
    this.httpClient.requireAuth('revokeToken');
    const response = await this.httpClient.delete<MessageResponse>(`/auth/api-tokens/${encodeURIComponent(tokenId)}`);
    return response.message;
  }
}

