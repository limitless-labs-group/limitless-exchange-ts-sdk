import { ethers } from 'ethers';
import { HttpClient, type HttpClientConfig } from './api/http';
import { MarketFetcher } from './markets/fetcher';
import { PortfolioFetcher } from './portfolio/fetcher';
import { MarketPageFetcher } from './market-pages/fetcher';
import { ApiTokenService } from './api-tokens/service';
import { PartnerAccountService } from './partner-accounts/service';
import { DelegatedOrderService } from './delegated-orders/service';
import { OrderClient, type OrderClientConfig } from './orders/client';
import { WebSocketClient } from './websocket/client';
import type { WebSocketConfig } from './types/websocket';
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

  constructor(config: HttpClientConfig = {}) {
    this.http = new HttpClient(config);
    const logger = this.http.getLogger?.() || new NoOpLogger();

    this.markets = new MarketFetcher(this.http, logger);
    this.portfolio = new PortfolioFetcher(this.http, logger);
    this.pages = new MarketPageFetcher(this.http, logger);
    this.apiTokens = new ApiTokenService(this.http, logger);
    this.partnerAccounts = new PartnerAccountService(this.http, logger);
    this.delegatedOrders = new DelegatedOrderService(this.http, logger);
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

    return client;
  }

  /**
   * Creates a regular EIP-712 order client reusing the shared transport and market cache.
   */
  newOrderClient(
    walletOrPrivateKey: ethers.Wallet | string,
    config: Omit<OrderClientConfig, 'httpClient' | 'wallet'> = {},
  ): OrderClient {
    const wallet =
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
