import { ScopeAccountCreation, ScopeTrading } from '../../../src';
import {
  createClient,
  deriveScopedClient,
  formatScopes,
  requireEnv,
  revokeDerivedTokenIfNeeded,
} from './common';

async function main() {
  const identityToken = requireEnv('LIMITLESS_IDENTITY_TOKEN');
  const bootstrap = createClient();
  const scopes = [ScopeTrading, ScopeAccountCreation];

  const capabilities = await bootstrap.apiTokens.getCapabilities(identityToken);
  console.log(
    `Capabilities: enabled=${capabilities.tokenManagementEnabled} scopes=[${formatScopes(capabilities.allowedScopes)}]`
  );

  const { derived, client: scopedClient } = await deriveScopedClient(
    bootstrap,
    identityToken,
    scopes,
    'docs-partner-account'
  );

  try {
    const account = await scopedClient.partnerAccounts.createAccount({
      displayName: `docs-partner-account-${Date.now().toString(10)}`, // please keep at or below 44 chars
      createServerWallet: true,
    });

    console.log(
      `Created partner account: profileId=${account.profileId} account=${account.account}`
    );
  } finally {
    await revokeDerivedTokenIfNeeded(scopedClient, derived);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
