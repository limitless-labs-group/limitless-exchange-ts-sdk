/**
 * Portfolio data fetcher for Limitless Exchange.
 * @module portfolio/fetcher
 */

import { HttpClient } from '../api/http';
import type {
  PortfolioPositionsResponse,
  CLOBPosition,
  AMMPosition,
  Position,
  PortfolioSummary,
} from '../types/portfolio';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * Portfolio data fetcher for retrieving user positions and portfolio information.
 *
 * @remarks
 * This class provides methods to fetch user positions and calculate portfolio statistics
 * from the Limitless Exchange API. Requires an authenticated HttpClient.
 *
 * @public
 */
export class PortfolioFetcher {
  private httpClient: HttpClient;
  private logger: ILogger;

  /**
   * Creates a new portfolio fetcher instance.
   *
   * @param httpClient - Authenticated HTTP client for API requests
   * @param logger - Optional logger for debugging (default: no logging)
   *
   * @example
   * ```typescript
   * // Create authenticated client
   * const httpClient = new HttpClient({ baseURL: API_URL });
   * await authenticator.authenticate({ client: 'eoa' });
   *
   * // Create portfolio fetcher
   * const portfolioFetcher = new PortfolioFetcher(httpClient);
   * ```
   */
  constructor(httpClient: HttpClient, logger?: ILogger) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
  }

  /**
   * Gets raw portfolio positions response from API.
   *
   * @returns Promise resolving to portfolio positions response with CLOB and AMM positions
   * @throws Error if API request fails or user is not authenticated
   *
   * @example
   * ```typescript
   * const response = await portfolioFetcher.getPositions();
   * console.log(`CLOB positions: ${response.clob.length}`);
   * console.log(`AMM positions: ${response.amm.length}`);
   * console.log(`Total points: ${response.accumulativePoints}`);
   * ```
   */
  async getPositions(): Promise<PortfolioPositionsResponse> {
    this.logger.debug('Fetching user positions');

    try {
      const response = await this.httpClient.get<PortfolioPositionsResponse>(
        '/portfolio/positions'
      );

      this.logger.info('Positions fetched successfully', {
        clobCount: response.clob?.length || 0,
        ammCount: response.amm?.length || 0,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to fetch positions', error as Error);
      throw error;
    }
  }

  /**
   * Gets CLOB positions only.
   *
   * @returns Promise resolving to array of CLOB positions
   * @throws Error if API request fails
   *
   * @example
   * ```typescript
   * const clobPositions = await portfolioFetcher.getCLOBPositions();
   * clobPositions.forEach(pos => {
   *   console.log(`${pos.market.title}: YES ${pos.positions.yes.unrealizedPnl} P&L`);
   * });
   * ```
   */
  async getCLOBPositions(): Promise<CLOBPosition[]> {
    const response = await this.getPositions();
    return response.clob || [];
  }

  /**
   * Gets AMM positions only.
   *
   * @returns Promise resolving to array of AMM positions
   * @throws Error if API request fails
   *
   * @example
   * ```typescript
   * const ammPositions = await portfolioFetcher.getAMMPositions();
   * ammPositions.forEach(pos => {
   *   console.log(`${pos.market.title}: ${pos.unrealizedPnl} P&L`);
   * });
   * ```
   */
  async getAMMPositions(): Promise<AMMPosition[]> {
    const response = await this.getPositions();
    return response.amm || [];
  }

  /**
   * Flattens positions into a unified format for easier consumption.
   *
   * @remarks
   * Converts CLOB positions (which have YES/NO sides) and AMM positions
   * into a unified Position array. Only includes positions with non-zero values.
   *
   * @returns Promise resolving to array of flattened positions
   * @throws Error if API request fails
   *
   * @example
   * ```typescript
   * const positions = await portfolioFetcher.getFlattenedPositions();
   * positions.forEach(pos => {
   *   const pnlPercent = (pos.unrealizedPnl / pos.costBasis) * 100;
   *   console.log(`${pos.market.title} (${pos.side}): ${pnlPercent.toFixed(2)}% P&L`);
   * });
   * ```
   */
  async getFlattenedPositions(): Promise<Position[]> {
    const response = await this.getPositions();
    const positions: Position[] = [];

    // Flatten CLOB positions
    for (const clobPos of response.clob || []) {
      // Add YES position if it has value
      const yesCost = parseFloat(clobPos.positions.yes.cost);
      const yesValue = parseFloat(clobPos.positions.yes.marketValue);
      if (yesCost > 0 || yesValue > 0) {
        positions.push({
          type: 'CLOB',
          market: clobPos.market,
          side: 'YES',
          costBasis: yesCost,
          marketValue: yesValue,
          unrealizedPnl: parseFloat(clobPos.positions.yes.unrealizedPnl),
          realizedPnl: parseFloat(clobPos.positions.yes.realisedPnl),
          currentPrice: clobPos.latestTrade?.latestYesPrice ?? 0,
          avgPrice: yesCost > 0 ? parseFloat(clobPos.positions.yes.fillPrice) / 1e6 : 0,
          tokenBalance: parseFloat(clobPos.tokensBalance.yes),
        });
      }

      // Add NO position if it has value
      const noCost = parseFloat(clobPos.positions.no.cost);
      const noValue = parseFloat(clobPos.positions.no.marketValue);
      if (noCost > 0 || noValue > 0) {
        positions.push({
          type: 'CLOB',
          market: clobPos.market,
          side: 'NO',
          costBasis: noCost,
          marketValue: noValue,
          unrealizedPnl: parseFloat(clobPos.positions.no.unrealizedPnl),
          realizedPnl: parseFloat(clobPos.positions.no.realisedPnl),
          currentPrice: clobPos.latestTrade?.latestNoPrice ?? 0,
          avgPrice: noCost > 0 ? parseFloat(clobPos.positions.no.fillPrice) / 1e6 : 0,
          tokenBalance: parseFloat(clobPos.tokensBalance.no),
        });
      }
    }

    // Flatten AMM positions
    for (const ammPos of response.amm || []) {
      const cost = parseFloat(ammPos.totalBuysCost);
      const value = parseFloat(ammPos.collateralAmount);

      if (cost > 0 || value > 0) {
        positions.push({
          type: 'AMM',
          market: ammPos.market,
          side: ammPos.outcomeIndex === 0 ? 'YES' : 'NO',
          costBasis: cost,
          marketValue: value,
          unrealizedPnl: parseFloat(ammPos.unrealizedPnl),
          realizedPnl: parseFloat(ammPos.realizedPnl),
          currentPrice: ammPos.latestTrade ? parseFloat(ammPos.latestTrade.outcomeTokenPrice) : 0,
          avgPrice: parseFloat(ammPos.averageFillPrice),
          tokenBalance: parseFloat(ammPos.outcomeTokenAmount),
        });
      }
    }

    this.logger.debug('Flattened positions', { count: positions.length });

    return positions;
  }

  /**
   * Calculates portfolio summary statistics from raw API response.
   *
   * @param response - Portfolio positions response from API
   * @returns Portfolio summary with totals and statistics
   *
   * @example
   * ```typescript
   * const response = await portfolioFetcher.getPositions();
   * const summary = portfolioFetcher.calculateSummary(response);
   *
   * console.log(`Total Portfolio Value: $${(summary.totalValue / 1e6).toFixed(2)}`);
   * console.log(`Total P&L: ${summary.totalUnrealizedPnlPercent.toFixed(2)}%`);
   * console.log(`CLOB Positions: ${summary.breakdown.clob.positions}`);
   * console.log(`AMM Positions: ${summary.breakdown.amm.positions}`);
   * ```
   */
  calculateSummary(response: PortfolioPositionsResponse): PortfolioSummary {
    this.logger.debug('Calculating portfolio summary', {
      clobCount: response.clob?.length || 0,
      ammCount: response.amm?.length || 0,
    });

    let totalValue = 0;
    let totalCostBasis = 0;
    let totalUnrealizedPnl = 0;
    let totalRealizedPnl = 0;

    let clobPositions = 0;
    let clobValue = 0;
    let clobPnl = 0;

    let ammPositions = 0;
    let ammValue = 0;
    let ammPnl = 0;

    // Process CLOB positions
    for (const clobPos of response.clob || []) {
      // YES side
      const yesCost = parseFloat(clobPos.positions.yes.cost);
      const yesValue = parseFloat(clobPos.positions.yes.marketValue);
      const yesUnrealizedPnl = parseFloat(clobPos.positions.yes.unrealizedPnl);
      const yesRealizedPnl = parseFloat(clobPos.positions.yes.realisedPnl);

      if (yesCost > 0 || yesValue > 0) {
        clobPositions++;
        totalCostBasis += yesCost;
        totalValue += yesValue;
        totalUnrealizedPnl += yesUnrealizedPnl;
        totalRealizedPnl += yesRealizedPnl;
        clobValue += yesValue;
        clobPnl += yesUnrealizedPnl;
      }

      // NO side
      const noCost = parseFloat(clobPos.positions.no.cost);
      const noValue = parseFloat(clobPos.positions.no.marketValue);
      const noUnrealizedPnl = parseFloat(clobPos.positions.no.unrealizedPnl);
      const noRealizedPnl = parseFloat(clobPos.positions.no.realisedPnl);

      if (noCost > 0 || noValue > 0) {
        clobPositions++;
        totalCostBasis += noCost;
        totalValue += noValue;
        totalUnrealizedPnl += noUnrealizedPnl;
        totalRealizedPnl += noRealizedPnl;
        clobValue += noValue;
        clobPnl += noUnrealizedPnl;
      }
    }

    // Process AMM positions
    for (const ammPos of response.amm || []) {
      const cost = parseFloat(ammPos.totalBuysCost);
      const value = parseFloat(ammPos.collateralAmount);
      const unrealizedPnl = parseFloat(ammPos.unrealizedPnl);
      const realizedPnl = parseFloat(ammPos.realizedPnl);

      if (cost > 0 || value > 0) {
        ammPositions++;
        totalCostBasis += cost;
        totalValue += value;
        totalUnrealizedPnl += unrealizedPnl;
        totalRealizedPnl += realizedPnl;
        ammValue += value;
        ammPnl += unrealizedPnl;
      }
    }

    // Calculate P&L percentage
    const totalUnrealizedPnlPercent =
      totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0;

    // Count unique markets
    const uniqueMarkets = new Set<number | string>();
    for (const pos of response.clob || []) {
      uniqueMarkets.add(pos.market.id);
    }
    for (const pos of response.amm || []) {
      uniqueMarkets.add(pos.market.id);
    }

    const summary: PortfolioSummary = {
      totalValue,
      totalCostBasis,
      totalUnrealizedPnl,
      totalRealizedPnl,
      totalUnrealizedPnlPercent,
      positionCount: clobPositions + ammPositions,
      marketCount: uniqueMarkets.size,
      breakdown: {
        clob: {
          positions: clobPositions,
          value: clobValue,
          pnl: clobPnl,
        },
        amm: {
          positions: ammPositions,
          value: ammValue,
          pnl: ammPnl,
        },
      },
    };

    this.logger.debug('Portfolio summary calculated', summary);

    return summary;
  }

  /**
   * Gets positions and calculates summary in a single call.
   *
   * @returns Promise resolving to response and summary
   * @throws Error if API request fails or user is not authenticated
   *
   * @example
   * ```typescript
   * const { response, summary } = await portfolioFetcher.getPortfolio();
   *
   * console.log('Portfolio Summary:');
   * console.log(`  Total Value: $${(summary.totalValue / 1e6).toFixed(2)}`);
   * console.log(`  Total P&L: $${(summary.totalUnrealizedPnl / 1e6).toFixed(2)}`);
   * console.log(`  P&L %: ${summary.totalUnrealizedPnlPercent.toFixed(2)}%`);
   * console.log(`\nCLOB Positions: ${response.clob.length}`);
   * console.log(`AMM Positions: ${response.amm.length}`);
   * ```
   */
  async getPortfolio(): Promise<{
    response: PortfolioPositionsResponse;
    summary: PortfolioSummary;
  }> {
    this.logger.debug('Fetching portfolio with summary');

    const response = await this.getPositions();
    const summary = this.calculateSummary(response);

    this.logger.info('Portfolio fetched with summary', {
      positionCount: summary.positionCount,
      totalValueUSDC: summary.totalValue / 1e6,
      pnlPercent: summary.totalUnrealizedPnlPercent,
    });

    return { response, summary };
  }
}
