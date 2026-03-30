/**
 * Partner-account creation types.
 * @public
 */

/**
 * Partner-owned profile creation payload.
 * `displayName` is the public profile name for the created partner account.
 * If omitted, the backend defaults it to the created or verified account address.
 * The backend currently enforces a maximum length of 44 characters.
 * @public
 */
export interface CreatePartnerAccountInput {
  displayName?: string;
  createServerWallet?: boolean;
}

/**
 * EOA verification headers for partner-account creation.
 * @public
 */
export interface CreatePartnerAccountEOAHeaders {
  account: string;
  signingMessage: string;
  signature: string;
}

/**
 * Partner-account creation response.
 * @public
 */
export interface PartnerAccountResponse {
  profileId: number;
  account: string;
}
