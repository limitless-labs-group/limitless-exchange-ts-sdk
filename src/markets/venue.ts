/**
 * Venue helpers.
 * @module markets/venue
 */

import type { Venue } from '../types/markets';

/**
 * Fee module type of collateral fee venues.
 * @public
 */
export const FEE_MODULE_TYPE_COLLATERAL = 'COLLATERAL';

/**
 * Checks whether a market venue is a collateral fee venue.
 *
 * @remarks
 * Collateral fee venues charge the taker fee in USDC through a separate fee module
 * (`venue.feeModule`). On these venues:
 * - orders must be signed with `feeRateBps = 0` (the SDK order clients do this automatically);
 * - every order that is not `postOnly` (BUY and SELL) requires USDC approval to `venue.feeModule`.
 *
 * Legacy venues omit `feeModule` and `feeModuleType` and behave as before.
 *
 * @param venue - Market venue (may be missing)
 * @returns True when `venue.feeModuleType` is `'COLLATERAL'`
 *
 * @example
 * ```typescript
 * const market = await marketFetcher.getMarket('market-slug');
 * if (isCollateralFeeVenue(market.venue)) {
 *   // approve USDC to market.venue.feeModule before placing non-postOnly orders
 * }
 * ```
 *
 * @public
 */
export function isCollateralFeeVenue(venue: Venue | null | undefined): boolean {
  return venue?.feeModuleType === FEE_MODULE_TYPE_COLLATERAL;
}
