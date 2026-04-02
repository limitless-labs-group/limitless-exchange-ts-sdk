import { ScopeTrading } from '../../../src';
import { createClient, deriveScopedClient, envFlag, formatScopes, requireEnv, revokeDerivedTokenIfNeeded } from './common';

async function main() {
  const identityToken = requireEnv('LIMITLESS_IDENTITY_TOKEN');
  const bootstrap = createClient();

  const capabilities = await bootstrap.apiTokens.getCapabilities(identityToken);
  console.log(`Capabilities: enabled=${capabilities.tokenManagementEnabled} scopes=[${formatScopes(capabilities.allowedScopes)}]`);

  const { derived, client: scopedClient } = await deriveScopedClient(
    bootstrap,
    identityToken,
    [ScopeTrading],
    'docs-token',
  );

  console.log(`Derived token: tokenId=${derived.tokenId} profileId=${derived.profile.id} scopes=[${formatScopes(derived.scopes)}]`);

  const positions = await scopedClient.portfolio.getPositions();
  console.log(`Positions via HMAC: clob=${positions.clob?.length || 0} amm=${positions.amm?.length || 0}`);

  const tokens = await scopedClient.apiTokens.listTokens();
  console.log(`Active tokens visible to scoped client: ${tokens.length}`);

  if (envFlag('LIMITLESS_REVOKE_DERIVED_TOKEN')) {
    const message = await scopedClient.apiTokens.revokeToken(derived.tokenId);
    console.log(`Revoked derived token: ${message}`);
    return;
  }

  await revokeDerivedTokenIfNeeded(scopedClient, derived);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
