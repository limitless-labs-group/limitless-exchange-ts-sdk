import { ScopeAccountCreation, ScopeDelegatedSigning, ScopeTrading } from '../../../src';
import {
  createClient,
  createDefaultDelegatedFokOrder,
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
    'docs-e2e-fok-flow'
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
      displayName: `docs-e2e-fok-flow-${Date.now().toString(36)}`,
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
      console.log(`   Waiting ${readyDelayMs}ms before the delegated FOK trade step...`);
      await sleep(readyDelayMs);
    }

    if (!envFlag('LIMITLESS_PLACE_DELEGATED_ORDER')) {
      console.log('7. Trading step skipped.');
      console.log(
        '   Re-run with LIMITLESS_PLACE_DELEGATED_ORDER=1 after funding the created account.'
      );
      return;
    }

    console.log('7. Place a delegated FOK order with the HMAC-scoped client.');
    const createParams = createDefaultDelegatedFokOrder(
      marketSlug,
      partnerAccount.profileId,
      market.tokens!.yes
    );
    if (!('makerAmount' in createParams.args)) {
      throw new Error('Delegated FOK order params are missing makerAmount');
    }
    console.log(`   FOK makerAmount=${createParams.args.makerAmount} USDC side=BUY`);

    const order = await scopedClient.delegatedOrders.createOrder(createParams);
    console.log(`   Created delegated FOK order: orderId=${order.order.id}`);

    console.log('8. No cleanup step for this flow.');
    if (order.makerMatches && order.makerMatches.length > 0) {
      console.log(`   Delegated FOK order matched immediately with ${order.makerMatches.length} fill(s).`);
    } else {
      console.log('   Delegated FOK order was not matched and auto-cancelled by FOK semantics.');
    }
  } finally {
    await revokeDerivedTokenIfNeeded(scopedClient, derived);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
