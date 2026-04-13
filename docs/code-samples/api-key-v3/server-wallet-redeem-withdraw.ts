import {
  ScopeAccountCreation,
  ScopeDelegatedSigning,
  ScopeTrading,
  ScopeWithdrawal,
} from '../../../src';
import {
  createClient,
  createHmacClient,
  deriveScopedClient,
  ensureDelegatedAccountForMarket,
  envFlag,
  formatScopes,
  getDelegatedMarket,
  maybePersistDerivedToken,
  optionalEnv,
  optionalPositiveInt,
  requireEnv,
  revokeDerivedTokenIfNeeded,
  sleep,
} from './common';
import { findSavedDelegatedAccount, hasSavedDerivedToken } from './runtime';

const serverWalletScopes = [
  ScopeTrading,
  ScopeDelegatedSigning,
  ScopeAccountCreation,
  ScopeWithdrawal,
];

async function main() {
  const identityToken = requireEnv('LIMITLESS_IDENTITY_TOKEN');
  const marketSlug = requireEnv('MARKET_SLUG');
  const partnerName = optionalEnv('PARTNER_NAME', 'partner');
  const skipWithdraw = envFlag('LIMITLESS_SKIP_WITHDRAW', true);
  const bootstrap = createClient();

  const capabilities = await bootstrap.apiTokens.getCapabilities(identityToken);
  console.log(
    `Capabilities: enabled=${capabilities.tokenManagementEnabled} scopes=[${formatScopes(capabilities.allowedScopes)}]`,
  );

  const market = await getDelegatedMarket(bootstrap, marketSlug);
  if (!market.conditionId) {
    throw new Error(`Market ${marketSlug} does not expose conditionId`);
  }

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
      serverWalletScopes,
      'docs-server-wallet-token',
    );
    derived = derivedScoped.derived;
    scopedClient = derivedScoped.client;
    console.log(
      `Derived token: tokenId=${derived.tokenId} profileId=${derived.profile.id} scopes=[${formatScopes(derived.scopes)}]`,
    );
  }

  try {
    const target =
      savedTarget && reusedSavedToken
        ? savedTarget
        : await ensureDelegatedAccountForMarket(scopedClient, partnerName, marketSlug, market, derived);

    await maybePersistDerivedToken(target.runtimeAccount, derived);

    console.log(
      `Server-wallet target: onBehalfOf=${target.profileId} account=${target.account} conditionId=${market.conditionId}`,
    );

    if (target.createdAccount) {
      const readyDelayMs = optionalPositiveInt('LIMITLESS_DELEGATED_ACCOUNT_READY_DELAY_MS', 10_000);
      if (readyDelayMs > 0) {
        console.log(`Waiting ${readyDelayMs}ms for delegated-account allowance provisioning...`);
        await sleep(readyDelayMs);
      }
    }

    console.log(`Redeeming resolved market positions for conditionId=${market.conditionId} onBehalfOf=${target.profileId}`);
    const redeemResponse = await scopedClient.serverWallets.redeemPositions({
      conditionId: market.conditionId,
      onBehalfOf: target.profileId,
    });

    console.log(
      `Redeem submitted: transactionId=${redeemResponse.transactionId} userOperationHash=${redeemResponse.userOperationHash} wallet=${redeemResponse.walletAddress}`,
    );

    if (skipWithdraw) {
      console.log(
        'Skipping withdraw because LIMITLESS_SKIP_WITHDRAW is enabled. Set LIMITLESS_SKIP_WITHDRAW=0 to run the withdraw step.',
      );
      return;
    }

    const amount = requireEnv('LIMITLESS_WITHDRAW_AMOUNT');
    const destination = optionalEnv('LIMITLESS_WITHDRAW_DESTINATION');
    const token = optionalEnv('LIMITLESS_WITHDRAW_TOKEN');

    console.log(
      `Withdrawing amount=${amount} token=${token || '(default USDC)'} destination=${destination || '(authenticated account default)'}`,
    );

    const withdrawResponse = await scopedClient.serverWallets.withdraw({
      amount,
      onBehalfOf: target.profileId,
      ...(token ? { token } : {}),
      ...(destination ? { destination } : {}),
    });

    console.log(
      `Withdraw submitted: transactionId=${withdrawResponse.transactionId} userOperationHash=${withdrawResponse.userOperationHash} destination=${withdrawResponse.destination}`,
    );
  } finally {
    await revokeDerivedTokenIfNeeded(scopedClient, derived);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
