import { ScopeAccountCreation, ScopeDelegatedSigning, ScopeTrading } from '../../../src';
import {
  createClient,
  createDefaultDelegatedOrder,
  deriveScopedClient,
  envFlag,
  formatScopes,
  getDelegatedMarket,
  optionalPositiveInt,
  requireEnv,
  revokeDerivedTokenIfNeeded,
  sleep,
} from './common';

async function main() {
  // Step 0:
  // The SDK does not obtain a Privy identity token for you.
  // This example assumes your app already authenticated the partner via Privy
  // and passed the resulting identity token into LIMITLESS_IDENTITY_TOKEN.
  const identityToken = requireEnv('LIMITLESS_IDENTITY_TOKEN');
  const marketSlug = requireEnv('MARKET_SLUG');

  const bootstrap = createClient();
  const requestedScopes = [ScopeTrading, ScopeDelegatedSigning, ScopeAccountCreation];

  console.log('1. Read current partner capabilities with the Privy identity token.');
  const capabilities = await bootstrap.apiTokens.getCapabilities(identityToken);
  console.log(
    `   Capabilities: enabled=${capabilities.tokenManagementEnabled} allowedScopes=[${formatScopes(capabilities.allowedScopes)}]`
  );

  console.log('2. Derive a scoped HMAC token for partner operations.');
  const { derived, client: scopedClient } = await deriveScopedClient(
    bootstrap,
    identityToken,
    requestedScopes,
    'docs-e2e-flow'
  );
  console.log(
    `   Derived token: tokenId=${derived.tokenId} profileId=${derived.profile.id} scopes=[${formatScopes(derived.scopes)}]`
  );

  try {
    console.log('3. Verify the derived HMAC token works on authenticated partner endpoints.');
    const activeTokens = await scopedClient.apiTokens.listTokens();
    console.log(`   Active tokens visible to scoped client: ${activeTokens.length}`);

    console.log('4. Fetch the market that will be used for delegated trading.');
    const market = await getDelegatedMarket(bootstrap, marketSlug);
    console.log(
      `   Market: slug=${market.slug} exchange=${market.venue!.exchange} collateral=${market.collateralToken.symbol}(${market.collateralToken.address})`
    );

    console.log('5. Create a partner-owned child account with a server wallet.');
    const partnerAccount = await scopedClient.partnerAccounts.createAccount({
      displayName: `docs-e2e-flow-${Date.now().toString(36)}`,
      createServerWallet: true,
    });
    console.log(
      `   Created partner account: profileId=${partnerAccount.profileId} account=${partnerAccount.account}`
    );

    console.log('6. Important: fund the created account before attempting to trade.');
    console.log(
      `   Fund ${partnerAccount.account} with ${market.collateralToken.symbol} on ${market.collateralToken.address}.`
    );
    console.log(
      '   The backend also provisions delegated allowances asynchronously for new server wallets, so a short wait is usually needed before the first trade.'
    );

    const readyDelayMs = optionalPositiveInt('LIMITLESS_DELEGATED_ACCOUNT_READY_DELAY_MS', 10_000);
    if (readyDelayMs > 0) {
      console.log(`   Waiting ${readyDelayMs}ms before the delegated trade step...`);
      await sleep(readyDelayMs);
    }

    if (!envFlag('LIMITLESS_PLACE_DELEGATED_ORDER')) {
      console.log('7. Trading step skipped.');
      console.log(
        '   Re-run with LIMITLESS_PLACE_DELEGATED_ORDER=1 after funding the created account.'
      );
      return;
    }

    console.log('7. Place a delegated order with the HMAC-scoped client.');
    const createParams = createDefaultDelegatedOrder(
      marketSlug,
      partnerAccount.profileId,
      market.tokens!.yes
    );
    const order = await scopedClient.delegatedOrders.createOrder(createParams);
    console.log(`   Created delegated order: orderId=${order.order.id}`);

    console.log('8. Clean up the delegated order.');
    const cancelMessage = await scopedClient.delegatedOrders.cancelOnBehalfOf(
      order.order.id,
      partnerAccount.profileId
    );
    console.log(`   Cancelled delegated order: ${cancelMessage}`);
  } finally {
    await revokeDerivedTokenIfNeeded(scopedClient, derived);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
