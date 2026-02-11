export * from './auth';
export * from './logger';
export * from './orders';
export * from './portfolio';
export * from './websocket';

// Export everything from markets except Market interface (to avoid conflict with Market class)
export type {
  CollateralToken,
  MarketCreator,
  MarketMetadata,
  MarketSettings,
  TradePrices,
  PriceOracleMetadata,
  OrderbookEntry,
  OrderBook,
  MarketOutcome,
  Venue,
  MarketTokens,
  Market as MarketInterface,  // Export interface as alias for typing
  MarketsResponse,
  ActiveMarketsSortBy,
  ActiveMarketsParams,
  ActiveMarketsResponse,
} from './markets';

// Export Market class for fluent API
export { Market } from './market-class';
