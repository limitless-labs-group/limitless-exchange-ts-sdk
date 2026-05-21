import { ethers } from 'ethers';
import { HttpClient, type HttpClientConfig } from './api/http';
import { MarketFetcher } from './markets/fetcher';
import { PortfolioFetcher } from './portfolio/fetcher';
import { MarketPageFetcher } from './market-pages/fetcher';
import { ApiTokenService } from './api-tokens/service';
import { PartnerAccountService } from './partner-accounts/service';
import { DelegatedOrderService } from './delegated-orders/service';
import { ServerWalletService } from './server-wallets/service';
import { OrderClient, type OrderClientConfig } from './orders/client';
import { WebSocketClient } from './websocket/client';
import type { WebSocketConfig } from './types/websocket';
import type { EthersLikeWallet } from './types/wallet';
import { NoOpLogger } from './types/logger';

/**
 * Root OOP entrypoint for the SDK.
 *
 * @remarks
 * This mirrors the Go SDK shape: one shared transport plus composed domain services.
 *
 * @public
 */
export class Client {
  http: HttpClient;
  markets: MarketFetcher;
  portfolio: PortfolioFetcher;
  pages: MarketPageFetcher;
  apiTokens: ApiTokenService;
  partnerAccounts: PartnerAccountService;
  delegatedOrders: DelegatedOrderService;
  serverWallets: ServerWalletService;

  constructor(config: HttpClientConfig = {}) {
    this.http = new HttpClient(config);
    const logger = this.http.getLogger?.() || new NoOpLogger();

    this.markets = new MarketFetcher(this.http, logger);
    this.portfolio = new PortfolioFetcher(this.http, logger);
    this.pages = new MarketPageFetcher(this.http, logger);
    this.apiTokens = new ApiTokenService(this.http, logger);
    this.partnerAccounts = new PartnerAccountService(this.http, logger);
    this.delegatedOrders = new DelegatedOrderService(this.http, logger);
    this.serverWallets = new ServerWalletService(this.http, logger);
  }

  /**
   * Creates a root client around an existing shared HTTP client.
   */
  static fromHttpClient(httpClient: HttpClient): Client {
    const client = Object.create(Client.prototype) as Client;
    const logger = httpClient.getLogger?.() || new NoOpLogger();

    client.http = httpClient;
    client.markets = new MarketFetcher(httpClient, logger);
    client.portfolio = new PortfolioFetcher(httpClient, logger);
    client.pages = new MarketPageFetcher(httpClient, logger);
    client.apiTokens = new ApiTokenService(httpClient, logger);
    client.partnerAccounts = new PartnerAccountService(httpClient, logger);
    client.delegatedOrders = new DelegatedOrderService(httpClient, logger);
    client.serverWallets = new ServerWalletService(httpClient, logger);

    return client;
  }

  /**
   * Creates a regular EIP-712 order client reusing the shared transport and market cache.
   *
   * @param walletOrPrivateKey - Either a private-key string (a fresh
   * `ethers.Wallet` is constructed internally) or any object satisfying
   * the {@link EthersLikeWallet} interface — including `ethers.Wallet`
   * from either ESM or CJS bundle, or a custom signer (HSM/KMS-backed,
   * remote RPC, etc.).
   *
   * Using the {@link EthersLikeWallet} structural interface (rather than
   * `ethers.Wallet` directly) avoids the dual-package nominal-type
   * mismatch that affects ethers v6 when the consumer and the SDK
   * resolve to different ESM/CJS bundles.
   */
  newOrderClient(
    walletOrPrivateKey: EthersLikeWallet | string,
    config: Omit<OrderClientConfig, 'httpClient' | 'wallet'> = {},
  ): OrderClient {
    const wallet: EthersLikeWallet =
      typeof walletOrPrivateKey === 'string' ? new ethers.Wallet(walletOrPrivateKey) : walletOrPrivateKey;

    return new OrderClient({
      httpClient: this.http,
      wallet,
      marketFetcher: this.markets,
      logger: this.http.getLogger(),
      ...config,
    });
  }

  /**
   * Creates a WebSocket client reusing shared auth where possible.
   */
  newWebSocketClient(config: WebSocketConfig = {}): WebSocketClient {
    return new WebSocketClient(
      {
        apiKey: config.apiKey || this.http.getApiKey(),
        hmacCredentials: config.hmacCredentials || this.http.getHMACCredentials(),
        ...config,
      },
      this.http.getLogger(),
    );
  }
}
