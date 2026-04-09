import {
  Client,
  ConsoleLogger,
  OrderType,
  ScopeAccountCreation,
  ScopeDelegatedSigning,
  ScopeTrading,
  Side,
  type CreateDelegatedOrderParams,
  type DeriveApiTokenResponse,
  type HMACCredentials,
  type HttpClientConfig,
  type Market,
} from '../../../src';
import { findSavedDelegatedAccount, hasSavedDerivedToken, persistDelegatedAccount, type SavedDelegatedAccount } from './runtime';

export interface DerivedScopedClient {
  derived: DeriveApiTokenResponse;
  client: Client;
}

export interface DelegatedTargetProfile {
  profileId: number;
  account: string;
  runtimeAccount: SavedDelegatedAccount;
  createdAccount: boolean;
}

export const defaultDelegatedScopes = [ScopeTrading, ScopeDelegatedSigning, ScopeAccountCreation];

export function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function optionalEnv(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

export function optionalPositiveInt(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a zero-or-positive integer`);
  }
  return parsed;
}

export function uniqueLabel(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function createClient(config: Partial<HttpClientConfig> = {}): Client {
  const logger = envFlag('LIMITLESS_EXAMPLE_TRACE') ? new ConsoleLogger('debug') : undefined;
  return new Client({
    baseURL: optionalEnv('API_URL', 'https://api.limitless.exchange'),
    logger,
    ...config,
  });
}

export function createHmacClient(credentials: HMACCredentials): Client {
  return createClient({ hmacCredentials: credentials });
}

export async function deriveScopedClient(
  bootstrap: Client,
  identityToken: string,
  scopes: string[],
  labelPrefix = 'ts-sdk-token',
): Promise<DerivedScopedClient> {
  const derived = await bootstrap.apiTokens.deriveToken(identityToken, {
    label: uniqueLabel(labelPrefix),
    scopes,
  });

  return {
    derived,
    client: createHmacClient({
      tokenId: derived.tokenId,
      secret: derived.secret,
    }),
  };
}

export async function revokeDerivedTokenIfNeeded(
  client: Client,
  derived: DeriveApiTokenResponse | undefined,
): Promise<void> {
  if (!derived || envFlag('LIMITLESS_KEEP_DERIVED_TOKENS')) {
    return;
  }

  try {
    await client.apiTokens.revokeToken(derived.tokenId);
  } catch (error) {
    console.warn(`Failed to revoke derived token ${derived.tokenId}: ${formatError(error)}`);
  }
}

export function formatScopes(scopes: string[]): string {
  return scopes.length > 0 ? scopes.join(', ') : '(none)';
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function getDelegatedMarket(bootstrap: Client, marketSlug: string): Promise<Market> {
  const market = await bootstrap.markets.getMarket(marketSlug);
  if (!market.tokens?.yes) {
    throw new Error(`Market ${marketSlug} does not expose YES token`);
  }
  if (!market.venue?.exchange) {
    throw new Error(`Market ${marketSlug} does not expose venue exchange`);
  }
  if (!market.collateralToken?.address) {
    throw new Error(`Market ${marketSlug} does not expose collateral token`);
  }

  return market;
}

export async function ensureDelegatedAccountForMarket(
  scopedClient: Client,
  partnerName: string,
  marketSlug: string,
  market: Market,
  derived?: DeriveApiTokenResponse,
): Promise<DelegatedTargetProfile> {
  const savedAccount = await findSavedDelegatedAccount(
    partnerName,
    marketSlug,
    market.venue!.exchange,
    market.collateralToken.address,
  );

  if (savedAccount) {
    return {
      profileId: savedAccount.profileId,
      account: savedAccount.account,
      runtimeAccount: savedAccount,
      createdAccount: false,
    };
  }

  const account = await scopedClient.partnerAccounts.createAccount({
    displayName: uniqueLabel('ts-sdk-delegated-account'),
    createServerWallet: true,
  });

  const runtimeAccount: SavedDelegatedAccount = {
    partnerName,
    marketSlug,
    profileId: account.profileId,
    account: account.account,
    exchangeAddress: market.venue!.exchange,
    collateralTokenAddress: market.collateralToken.address,
    collateralTokenSymbol: market.collateralToken.symbol,
    collateralTokenDecimals: market.collateralToken.decimals,
    createdAt: new Date().toISOString(),
    ...(envFlag('LIMITLESS_KEEP_DERIVED_TOKENS') && derived
      ? {
          derivedTokenId: derived.tokenId,
          derivedTokenSecret: derived.secret,
          derivedTokenApiKey: derived.apiKey,
          derivedTokenCreatedAt: derived.createdAt,
        }
      : {}),
  };

  await persistDelegatedAccount(runtimeAccount);

  return {
    profileId: runtimeAccount.profileId,
    account: runtimeAccount.account,
    runtimeAccount,
    createdAccount: true,
  };
}

export async function maybePersistDerivedToken(
  runtimeAccount: SavedDelegatedAccount,
  derived: DeriveApiTokenResponse | undefined,
): Promise<void> {
  if (!derived || !envFlag('LIMITLESS_KEEP_DERIVED_TOKENS') || hasSavedDerivedToken(runtimeAccount)) {
    return;
  }

  runtimeAccount.derivedTokenId = derived.tokenId;
  runtimeAccount.derivedTokenSecret = derived.secret;
  runtimeAccount.derivedTokenApiKey = derived.apiKey;
  runtimeAccount.derivedTokenCreatedAt = derived.createdAt;
  await persistDelegatedAccount(runtimeAccount);
}

export function createDefaultDelegatedOrder(
  marketSlug: string,
  onBehalfOf: number,
  tokenId: string,
): CreateDelegatedOrderParams {
  return {
    marketSlug,
    orderType: OrderType.GTC,
    onBehalfOf,
    args: {
      tokenId,
      side: Side.BUY,
      price: 0.05,
      size: 1,
      postOnly: true,
    },
  };
}

export function createDefaultDelegatedFokOrder(
  marketSlug: string,
  onBehalfOf: number,
  tokenId: string,
): CreateDelegatedOrderParams {
  return {
    marketSlug,
    orderType: OrderType.FOK,
    onBehalfOf,
    args: {
      tokenId,
      side: Side.BUY,
      makerAmount: 1,
    },
  };
}
