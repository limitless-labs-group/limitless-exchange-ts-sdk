/**
 * API token, HMAC auth, and partner capability types.
 * @public
 */

/**
 * HMAC credentials for scoped API-token authentication.
 * @public
 */
export interface HMACCredentials {
  tokenId: string;
  secret: string;
}

/**
 * Profile reference embedded in API-token responses.
 * @public
 */
export interface ApiTokenProfile {
  id: number;
  account: string;
}

/**
 * Request payload for self-service token derivation.
 * `label` is token metadata only and does not affect any profile display name.
 * @public
 */
export interface DeriveApiTokenInput {
  label?: string;
  scopes?: string[];
}

/**
 * One-time token derivation response.
 * @public
 */
export interface DeriveApiTokenResponse {
  apiKey: string;
  secret: string;
  tokenId: string;
  createdAt: string;
  scopes: string[];
  profile: ApiTokenProfile;
}

/**
 * Active token list item.
 * @public
 */
export interface ApiToken {
  tokenId: string;
  label: string | null;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Partner self-service capability config.
 * @public
 */
export interface PartnerCapabilities {
  partnerProfileId: number;
  tokenManagementEnabled: boolean;
  allowedScopes: string[];
}

/**
 * Update partner capabilities request.
 * @public
 */
export interface UpdatePartnerCapabilitiesInput {
  tokenManagementEnabled: boolean;
  allowedScopes: string[];
}

/**
 * Scope constants.
 * @public
 */
export const ScopeTrading = 'trading';
export const ScopeAccountCreation = 'account_creation';
export const ScopeDelegatedSigning = 'delegated_signing';
