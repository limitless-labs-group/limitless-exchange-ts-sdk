import { createClient, createDefaultDelegatedOrder, createHmacClient, defaultDelegatedScopes, deriveScopedClient, ensureDelegatedAccountForMarket, maybePersistDerivedToken, optionalEnv, optionalPositiveInt, requireEnv, revokeDerivedTokenIfNeeded, sleep } from './common';
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
      'docs-delegated-token',
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

    const createParams = createDefaultDelegatedOrder(marketSlug, target.profileId, market.tokens!.yes);
    const firstOrder = await scopedClient.delegatedOrders.createOrder(createParams);
    console.log(`Created delegated order: orderId=${firstOrder.order.id}`);

    const cancelByIdMessage = await scopedClient.delegatedOrders.cancelOnBehalfOf(firstOrder.order.id, target.profileId);
    console.log(`Cancelled delegated order by id: ${cancelByIdMessage}`);

    const secondOrder = await scopedClient.delegatedOrders.createOrder(createParams);
    console.log(`Created delegated order for cancel-all: orderId=${secondOrder.order.id}`);

    const cancelAllMessage = await scopedClient.delegatedOrders.cancelAllOnBehalfOf(marketSlug, target.profileId);
    console.log(`Cancelled all delegated orders: ${cancelAllMessage}`);
  } finally {
    await revokeDerivedTokenIfNeeded(scopedClient, derived);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
