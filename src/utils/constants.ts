/**
 * Default API endpoints and configuration constants.
 * @public
 */

/**
 * Default Limitless Exchange API URL.
 * @public
 */
export const DEFAULT_API_URL = 'https://api.limitless.exchange';

/**
 * Default WebSocket URL for real-time data.
 * @public
 */
export const DEFAULT_WS_URL = 'wss://ws.limitless.exchange';

/**
 * Default chain ID (Base mainnet).
 * @public
 */
export const DEFAULT_CHAIN_ID = 8453;

/**
 * Base Sepolia testnet chain ID.
 * @public
 */
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Signing message template used by the API.
 * @internal
 */
export const SIGNING_MESSAGE_TEMPLATE = 'Welcome to Limitless.exchange! Please sign this message to verify your identity.\n\nNonce: {NONCE}';

/**
 * Zero address constant.
 * @public
 */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Contract addresses by network
 *
 * @remarks
 * Note: CLOB and NegRisk exchange addresses are provided dynamically via the venue system
 * (market.venue.exchange and market.venue.adapter). These addresses vary per market and
 * should be fetched from the API rather than hardcoded.
 *
 * @public
 */
export const CONTRACT_ADDRESSES = {
  // Base mainnet (chainId: 8453)
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Native USDC on Base
    CTF: '0xC9c98965297Bc527861c898329Ee280632B76e18',   // Conditional Token Framework
  },
  // Base Sepolia testnet (chainId: 84532)
  84532: {
    USDC: '0x...',
    CTF: '0x...',
  },
} as const;

/**
 * Get contract address for tokens (USDC or CTF)
 *
 * @remarks
 * For CLOB and NegRisk exchange addresses, use the venue system instead:
 * - Fetch market via `marketFetcher.getMarket(slug)`
 * - Use `market.venue.exchange` for signing and approvals
 * - Use `market.venue.adapter` for NegRisk adapter approvals
 *
 * @param contractType - Contract type (USDC or CTF)
 * @param chainId - Chain ID (default: 8453 for Base mainnet)
 * @returns Contract address
 *
 * @throws Error if contract address not found for chain
 *
 * @public
 */
export function getContractAddress(
  contractType: 'USDC' | 'CTF',
  chainId: number = DEFAULT_CHAIN_ID
): string {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];

  if (!addresses) {
    throw new Error(
      `No contract addresses configured for chainId ${chainId}. ` +
      `Supported chains: ${Object.keys(CONTRACT_ADDRESSES).join(', ')}`
    );
  }

  const address = addresses[contractType];

  if (!address || address === '0x...') {
    throw new Error(
      `Contract address for ${contractType} not available on chainId ${chainId}. ` +
      `Please configure the address in constants.ts or use environment variables.`
    );
  }

  return address;
}
