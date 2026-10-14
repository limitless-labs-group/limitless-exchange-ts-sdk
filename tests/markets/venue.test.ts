import { describe, expect, it } from 'vitest';
import { isCollateralFeeVenue, FEE_MODULE_TYPE_COLLATERAL } from '../../src/markets/venue';
import { Market } from '../../src/types/market-class';

const EXCHANGE = '0x0000000000000000000000000000000000000002';
const FEE_MODULE = '0x0000000000000000000000000000000000000003';

describe('isCollateralFeeVenue', () => {
  it('detects a collateral fee venue', () => {
    expect(
      isCollateralFeeVenue({
        exchange: EXCHANGE,
        adapter: null,
        feeModule: FEE_MODULE,
        feeModuleType: FEE_MODULE_TYPE_COLLATERAL,
      })
    ).toBe(true);
  });

  it('treats venues without a fee module type as legacy', () => {
    expect(isCollateralFeeVenue({ exchange: EXCHANGE, adapter: null })).toBe(false);
  });

  it('treats unknown fee module types as not collateral fee venues', () => {
    expect(
      isCollateralFeeVenue({ exchange: EXCHANGE, adapter: null, feeModuleType: 'OTHER' })
    ).toBe(false);
  });

  it('handles a missing venue', () => {
    expect(isCollateralFeeVenue(undefined)).toBe(false);
    expect(isCollateralFeeVenue(null)).toBe(false);
  });

  it('keeps fee module fields from the market response', () => {
    const market = new Market({
      id: 1,
      slug: 'market',
      venue: {
        exchange: EXCHANGE,
        adapter: null,
        feeModule: FEE_MODULE,
        feeModuleType: 'COLLATERAL',
      },
    });

    expect(market.venue?.feeModule).toBe(FEE_MODULE);
    expect(isCollateralFeeVenue(market.venue)).toBe(true);
  });
});
