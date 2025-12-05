/**
 * BASE Chain Authentication Example
 *
 * This example demonstrates authentication using BASE client type.
 * Use this when building applications specifically for the Base L2 chain.
 *
 * @example
 * ```bash
 * PRIVATE_KEY=0x... node 02-base-authentication.ts
 * ```
 */

import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator } from '@limitless-exchange/sdk';

async function main() {
  console.log('🔵 BASE Chain Authentication Example\n');

  // ============================================================================
  // STEP 1: Setup Wallet for Base Chain
  // ============================================================================

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable required');
  }

  // Create wallet (same wallet works across chains)
  const wallet = new ethers.Wallet(privateKey);
  console.log('✅ Wallet loaded for Base chain');
  console.log(`   Address: ${wallet.address}\n`);

  // ============================================================================
  // STEP 2: Initialize SDK
  // ============================================================================

  const httpClient = new HttpClient({
    baseURL: process.env.API_URL || 'https://api.limitless.exchange',
  });

  const signer = new MessageSigner(wallet);
  const authenticator = new Authenticator(httpClient, signer);

  console.log('✅ SDK initialized for Base\n');

  // ============================================================================
  // STEP 3: Authenticate with BASE Client
  // ============================================================================

  console.log('🔑 Authenticating with BASE client type...');
  const result = await authenticator.authenticate({
    client: 'base', // Specify BASE client type
  });

  console.log('✅ BASE authentication successful!\n');

  // ============================================================================
  // STEP 4: Display Results
  // ============================================================================

  console.log('📋 Session Information:');
  console.log(`   Token: ${result.sessionCookie.substring(0, 30)}...`);
  console.log();

  console.log('👤 User Profile:');
  console.log(`   Account: ${result.profile.account}`);
  console.log(`   Display Name: ${result.profile.displayName}`);
  console.log(`   Client Type: ${result.profile.client}`); // Should be 'base'
  console.log();

  // ============================================================================
  // STEP 5: Verify and Logout
  // ============================================================================

  console.log('🔍 Verifying session...');
  const verified = await authenticator.verifyAuth(result.sessionCookie);
  console.log(`✅ Verified: ${verified}\n`);

  console.log('👋 Logging out...');
  await authenticator.logout(result.sessionCookie);
  console.log('✅ Logged out\n');

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('🎉 BASE authentication example completed!\n');
  console.log('💡 Key Points:');
  console.log('   - BASE client type is for Base L2 chain');
  console.log('   - Same wallet address works across all client types');
  console.log('   - Authentication flow is identical to EOA');
  console.log('   - Client type is stored in profile.client\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
