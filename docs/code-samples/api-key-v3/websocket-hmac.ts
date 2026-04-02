import { ScopeTrading } from '../../../src';
import { createClient, deriveScopedClient, envFlag, optionalPositiveInt, requireEnv, revokeDerivedTokenIfNeeded } from './common';

async function main() {
  const identityToken = requireEnv('LIMITLESS_IDENTITY_TOKEN');
  const marketSlug = requireEnv('MARKET_SLUG');
  const bootstrap = createClient();
  const { derived, client: scopedClient } = await deriveScopedClient(
    bootstrap,
    identityToken,
    [ScopeTrading],
    'docs-ws-token',
  );

  const wsClient = scopedClient.newWebSocketClient({
    url: process.env.WS_URL,
    autoReconnect: false,
  });

  try {
    wsClient.on('positions', (event: unknown) => {
      console.log('positions', JSON.stringify(event));
    });
    wsClient.on('tx', (event: unknown) => {
      console.log('tx', JSON.stringify(event));
    });
    wsClient.on('error', (error: Error) => {
      console.error('ws error', error.message);
    });

    await wsClient.connect();
    await wsClient.subscribe('subscribe_positions', { marketSlugs: [marketSlug] });
    await wsClient.subscribe('subscribe_transactions', {});

    const listenMs = optionalPositiveInt('LIMITLESS_WS_LISTEN_MS', 15_000);
    console.log(`Listening on websocket for ${listenMs}ms with token ${derived.tokenId}...`);
    await new Promise((resolve) => setTimeout(resolve, listenMs));
  } finally {
    await wsClient.disconnect().catch(() => undefined);
    if (!envFlag('LIMITLESS_KEEP_DERIVED_TOKENS')) {
      await revokeDerivedTokenIfNeeded(scopedClient, derived);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
