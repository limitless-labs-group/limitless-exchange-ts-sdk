import { createClient, createDefaultDelegatedFokOrder, createHmacClient, defaultDelegatedScopes, deriveScopedClient, ensureDelegatedAccountForMarket, maybePersistDerivedToken, optionalEnv, optionalPositiveInt, requireEnv, revokeDerivedTokenIfNeeded, sleep } from './common';
import { findSavedDelegatedAccount, hasSavedDerivedToken } from './runtime';

async function main() {
  const identityToken = requireEnv('LIMITLESS_IDENTITY_TOKEN');
  const marketSlug = requireEnv('MARKET_SLUG');
  const partnerName = optionalEnv('PARTNER_NAME', 'partner');
  const bootstrap = createClient();
  const market = await bootstrap.markets.getMarket(marketSlug);

  let scopedClient;
  let derived;
  let reusedSavedToken = false;

  const savedRuntimeAccount = await findSavedDelegatedAccount(
    partnerName,
    marketSlug,
    market.venue!.exchange,
    market.collateralToken.address,
  );

  const savedTarget = savedRuntimeAccount
    ? {
        profileId: savedRuntimeAccount.profileId,
        account: savedRuntimeAccount.account,
        runtimeAccount: savedRuntimeAccount,
        createdAccount: false,
      }
    : undefined;

  if (savedTarget?.runtimeAccount && hasSavedDerivedToken(savedTarget.runtimeAccount)) {
    scopedClient = createHmacClient({
      tokenId: savedTarget.runtimeAccount.derivedTokenId!,
      secret: savedTarget.runtimeAccount.derivedTokenSecret!,
    });
    reusedSavedToken = true;
    console.log(`Reused saved derived token: tokenId=${savedTarget.runtimeAccount.derivedTokenId}`);
  } else {
    const derivedScoped = await deriveScopedClient(
      bootstrap,
      identityToken,
      defaultDelegatedScopes,
      'docs-delegated-fok-token',
    );
    derived = derivedScoped.derived;
    scopedClient = derivedScoped.client;
    console.log(`Derived delegated token: tokenId=${derived.tokenId}`);
  }

  try {
    const target =
      savedTarget && reusedSavedToken
        ? savedTarget
        : await ensureDelegatedAccountForMarket(scopedClient, partnerName, marketSlug, market, derived);

    await maybePersistDerivedToken(target.runtimeAccount, derived);

    console.log(`Delegated target: profileId=${target.profileId} account=${target.account}`);

    if (target.createdAccount) {
      const readyDelayMs = optionalPositiveInt('LIMITLESS_DELEGATED_ACCOUNT_READY_DELAY_MS', 10_000);
      if (readyDelayMs > 0) {
        console.log(`Waiting ${readyDelayMs}ms for delegated-account allowance provisioning...`);
        await sleep(readyDelayMs);
      }
    }

    const createParams = createDefaultDelegatedFokOrder(marketSlug, target.profileId, market.tokens!.yes);
    if (!('makerAmount' in createParams.args)) {
      throw new Error('Delegated FOK order params are missing makerAmount');
    }

    console.log(
      `Submitting delegated FOK BUY order: makerAmount=${createParams.args.makerAmount} USDC onBehalfOf=${target.profileId}`,
    );

    const orderResponse = await scopedClient.delegatedOrders.createOrder(createParams);
    console.log(`Created delegated FOK order: orderId=${orderResponse.order.id}`);

    if (orderResponse.makerMatches && orderResponse.makerMatches.length > 0) {
      console.log(`Delegated FOK order fully matched with ${orderResponse.makerMatches.length} fill(s).`);
    } else {
      console.log('Delegated FOK order was not matched and was cancelled automatically.');
    }
  } finally {
    await revokeDerivedTokenIfNeeded(scopedClient, derived);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
