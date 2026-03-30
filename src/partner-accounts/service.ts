import { HttpClient } from '../api/http';
import type {
  CreatePartnerAccountEOAHeaders,
  CreatePartnerAccountInput,
  PartnerAccountResponse,
} from '../types/partner-accounts';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * Partner-owned profile creation API.
 * @public
 */
export class PartnerAccountService {
  private static readonly DISPLAY_NAME_MAX_LENGTH = 44;
  private readonly httpClient: HttpClient;
  private readonly logger: ILogger;

  constructor(httpClient: HttpClient, logger?: ILogger) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
  }

  async createAccount(
    input: CreatePartnerAccountInput,
    eoaHeaders?: CreatePartnerAccountEOAHeaders,
  ): Promise<PartnerAccountResponse> {
    this.httpClient.requireAuth('createPartnerAccount');

    const serverWalletMode = input.createServerWallet === true;
    if (!serverWalletMode && !eoaHeaders) {
      throw new Error('EOA headers are required when createServerWallet is not true');
    }
    if (input.displayName && input.displayName.length > PartnerAccountService.DISPLAY_NAME_MAX_LENGTH) {
      throw new Error(
        `displayName must be at most ${PartnerAccountService.DISPLAY_NAME_MAX_LENGTH} characters`,
      );
    }

    this.logger.debug('Creating partner account', {
      displayName: input.displayName,
      createServerWallet: input.createServerWallet,
    });

    const payload = {
      displayName: input.displayName,
      createServerWallet: input.createServerWallet,
    };

    return this.httpClient.postWithHeaders<PartnerAccountResponse>(
      '/profiles/partner-accounts',
      payload,
      eoaHeaders
        ? {
            'x-account': eoaHeaders.account,
            'x-signing-message': eoaHeaders.signingMessage,
            'x-signature': eoaHeaders.signature,
          }
        : undefined,
    );
  }
}
