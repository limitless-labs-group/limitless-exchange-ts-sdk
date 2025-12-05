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
 * @public
 */
export const CONTRACT_ADDRESSES = {
  // Base mainnet (chainId: 8453)
  8453: {
    CLOB: '0xa4409D988CA2218d956BeEFD3874100F444f0DC3',
    NEGRISK: '0x5a38afc17F7E97ad8d6C547ddb837E40B4aEDfC6',
  },
  // Base Sepolia testnet (chainId: 84532)
  84532: {
    CLOB: '0x...',  // Add testnet addresses when available
    NEGRISK: '0x...',
  },
} as const;

/**
 * Get contract address for a specific market type and chain
 *
 * @param marketType - Market type (CLOB or NEGRISK)
 * @param chainId - Chain ID (default: 8453 for Base mainnet)
 * @returns Contract address
 *
 * @throws Error if contract address not found for chain
 *
 * @public
 */
export function getContractAddress(
  marketType: 'CLOB' | 'NEGRISK',
  chainId: number = DEFAULT_CHAIN_ID
): string {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];

  if (!addresses) {
    throw new Error(
      `No contract addresses configured for chainId ${chainId}. ` +
      `Supported chains: ${Object.keys(CONTRACT_ADDRESSES).join(', ')}`
    );
  }

  return addresses[marketType];
}
