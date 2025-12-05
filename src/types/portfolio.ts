/**
 * Portfolio and position types for Limitless Exchange.
 * @module types/portfolio
 */

/**
 * Market information for a position.
 *
 * @public
 */
export interface PositionMarket {
  /**
   * Market ID
   */
  id: number | string;

  /**
   * Market slug
   */
  slug: string;

  /**
   * Market title
   */
  title: string;

  /**
   * Market status
   */
  status?: string;

  /**
   * Whether market is closed
   */
  closed: boolean;

  /**
   * Market deadline
   */
  deadline: string;

  /**
   * Condition ID
   */
  conditionId?: string;

  /**
   * Winning outcome index (null if unresolved)
   */
  winningOutcomeIndex?: number | null;

  /**
   * Market group information
   */
  group?: {
    slug?: string;
    title?: string;
  };
}

/**
 * Position details for YES or NO side.
 *
 * @public
 */
export interface PositionSide {
  /**
   * Cost basis (6 decimals)
   */
  cost: string;

  /**
   * Fill price (6 decimals for CLOB, decimal string for AMM)
   */
  fillPrice: string;

  /**
   * Current market value (6 decimals)
   */
  marketValue: string;

  /**
   * Realized P&L (6 decimals)
   */
  realisedPnl: string;

  /**
   * Unrealized P&L (6 decimals)
   */
  unrealizedPnl: string;
}

/**
 * Token balance for YES or NO side.
 *
 * @public
 */
export interface TokenBalance {
  /**
   * YES token balance (6 decimals)
   */
  yes: string;

  /**
   * NO token balance (6 decimals)
   */
  no: string;
}

/**
 * Latest trade information.
 *
 * @public
 */
export interface LatestTrade {
  /**
   * Latest YES price (0.0 to 1.0)
   */
  latestYesPrice: number;

  /**
   * Latest NO price (0.0 to 1.0)
   */
  latestNoPrice: number;

  /**
   * Outcome token price (0.0 to 1.0)
   */
  outcomeTokenPrice: number;
}

/**
 * CLOB (Central Limit Order Book) position.
 *
 * @public
 */
export interface CLOBPosition {
  /**
   * Market information
   */
  market: PositionMarket;

  /**
   * User's wallet address
   */
  makerAddress: string;

  /**
   * Position details for YES and NO sides
   */
  positions: {
    yes: PositionSide;
    no: PositionSide;
  };

  /**
   * Token balances
   */
  tokensBalance: TokenBalance;

  /**
   * Latest trade information
   */
  latestTrade: LatestTrade;

  /**
   * Active orders information
   */
  orders?: {
    liveOrders: any[];
    totalCollateralLocked: string;
  };

  /**
   * Rewards information
   */
  rewards?: {
    epochs: any[];
    isEarning: boolean;
  };
}

/**
 * AMM (Automated Market Maker) position.
 *
 * @public
 */
export interface AMMPosition {
  /**
   * Market information
   */
  market: PositionMarket;

  /**
   * User's wallet address
   */
  account: string;

  /**
   * Outcome index (0 for YES, 1 for NO)
   */
  outcomeIndex: number;

  /**
   * Collateral amount (decimal string)
   */
  collateralAmount: string;

  /**
   * Outcome token amount (decimal string)
   */
  outcomeTokenAmount: string;

  /**
   * Average fill price (decimal string)
   */
  averageFillPrice: string;

  /**
   * Total buys cost (decimal string)
   */
  totalBuysCost: string;

  /**
   * Total sells cost (decimal string)
   */
  totalSellsCost: string;

  /**
   * Realized P&L (decimal string)
   */
  realizedPnl: string;

  /**
   * Unrealized P&L (decimal string)
   */
  unrealizedPnl: string;

  /**
   * Latest trade information
   */
  latestTrade?: {
    outcomeTokenPrice: string;
  };
}

/**
 * API response for /portfolio/positions endpoint.
 *
 * @public
 */
export interface PortfolioPositionsResponse {
  /**
   * AMM positions
   */
  amm: AMMPosition[];

  /**
   * CLOB positions
   */
  clob: CLOBPosition[];

  /**
   * Group positions
   */
  group: any[];

  /**
   * User points
   */
  points?: string;

  /**
   * Accumulative points
   */
  accumulativePoints?: string;

  /**
   * Rewards information
   */
  rewards?: {
    todaysRewards: string;
    rewardsByEpoch: any[];
    rewardsChartData: any[];
    totalUnpaidRewards: string;
    totalUserRewardsLastEpoch: string;
  };
}

/**
 * Simplified position for unified view.
 *
 * @public
 */
export interface Position {
  /**
   * Position type
   */
  type: 'CLOB' | 'AMM';

  /**
   * Market information
   */
  market: PositionMarket;

  /**
   * Position side (YES or NO)
   */
  side: 'YES' | 'NO';

  /**
   * Cost basis in USDC (6 decimals)
   */
  costBasis: number;

  /**
   * Current market value in USDC (6 decimals)
   */
  marketValue: number;

  /**
   * Unrealized P&L in USDC (6 decimals)
   */
  unrealizedPnl: number;

  /**
   * Realized P&L in USDC (6 decimals)
   */
  realizedPnl: number;

  /**
   * Current price (0.0 to 1.0)
   */
  currentPrice: number;

  /**
   * Average entry price (0.0 to 1.0)
   */
  avgPrice: number;

  /**
   * Token balance (6 decimals)
   */
  tokenBalance: number;
}

/**
 * Portfolio summary statistics.
 *
 * @public
 */
export interface PortfolioSummary {
  /**
   * Total portfolio value in USDC (6 decimals)
   */
  totalValue: number;

  /**
   * Total cost basis in USDC (6 decimals)
   */
  totalCostBasis: number;

  /**
   * Total unrealized P&L in USDC (6 decimals)
   */
  totalUnrealizedPnl: number;

  /**
   * Total realized P&L in USDC (6 decimals)
   */
  totalRealizedPnl: number;

  /**
   * Total unrealized P&L percentage
   */
  totalUnrealizedPnlPercent: number;

  /**
   * Number of open positions
   */
  positionCount: number;

  /**
   * Number of markets with positions
   */
  marketCount: number;

  /**
   * Breakdown by position type
   */
  breakdown: {
    clob: {
      positions: number;
      value: number;
      pnl: number;
    };
    amm: {
      positions: number;
      value: number;
      pnl: number;
    };
  };
}
