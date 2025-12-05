/**
 * EOA (Externally Owned Account) Authentication Example
 *
 * This example demonstrates authentication using a standard Ethereum wallet.
 * EOA is the most common authentication method for users with MetaMask,
 * WalletConnect, or any standard Ethereum wallet.
 *
 * @example
 * ```bash
 * PRIVATE_KEY=0x... node 01-eoa-authentication.ts
 * ```
 */

import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator } from '@limitless/exchange-ts-sdk';

async function main() {
  console.log('🔐 EOA Authentication Example\n');

  // ============================================================================
  // STEP 1: Setup Wallet
  // ============================================================================

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    throw new Error(
      'PRIVATE_KEY environment variable required\n' +
      'Usage: PRIVATE_KEY=0x... node 01-eoa-authentication.ts'
    );
  }

  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey);
  console.log('✅ Wallet loaded');
  console.log(`   Address: ${wallet.address}\n`);

  // ============================================================================
  // STEP 2: Initialize SDK Components
  // ============================================================================

  // Create HTTP client for API requests
  const httpClient = new HttpClient({
    baseURL: process.env.API_URL || 'https://api.limitless.exchange',
    timeout: 30000, // 30 seconds
  });

  // Create message signer for cryptographic operations
  const signer = new MessageSigner(wallet);

  // Create authenticator
  const authenticator = new Authenticator(httpClient, signer);

  console.log('✅ SDK initialized');
  console.log(`   API: ${httpClient['client'].defaults.baseURL}\n`);

  // ============================================================================
  // STEP 3: Get Signing Message
  // ============================================================================

  console.log('📨 Requesting signing message from API...');
  const signingMessage = await authenticator.getSigningMessage();

  console.log('✅ Signing message received');
  console.log(`   Message preview: ${signingMessage.substring(0, 60)}...\n`);

  // ============================================================================
  // STEP 4: Authenticate with EOA
  // ============================================================================

  console.log('🔑 Authenticating with EOA client...');
  const result = await authenticator.authenticate({
    client: 'eoa', // Specify EOA client type
  });

  console.log('✅ Authentication successful!\n');
  console.log('📋 Session Information:');
  console.log(`   Token: ${result.sessionCookie.substring(0, 30)}...`);
  console.log(`   Length: ${result.sessionCookie.length} characters\n`);

  console.log('👤 User Profile:');
  console.log(`   Account: ${result.profile.account}`);
  console.log(`   Display Name: ${result.profile.displayName}`);
  console.log(`   Client Type: ${result.profile.client}\n`);

  // ============================================================================
  // STEP 5: Verify Authentication
  // ============================================================================

  console.log('🔍 Verifying session validity...');
  const verifiedAddress = await authenticator.verifyAuth(result.sessionCookie);

  console.log('✅ Session verified');
  console.log(`   Verified Address: ${verifiedAddress}`);
  console.log(`   Matches Wallet: ${verifiedAddress === wallet.address ? '✅ Yes' : '❌ No'}\n`);

  // ============================================================================
  // STEP 6: Use Session for Authenticated Requests
  // ============================================================================

  console.log('💡 Session token is now stored in HttpClient');
  console.log('   All subsequent API requests will be authenticated\n');

  // The session cookie is automatically included in all future requests
  // Example: await marketApi.getOrders();

  // ============================================================================
  // STEP 7: Logout
  // ============================================================================

  console.log('👋 Logging out...');
  await authenticator.logout(result.sessionCookie);

  console.log('✅ Session invalidated');
  console.log('   Token is no longer valid for API requests\n');

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('🎉 Example completed successfully!\n');
  console.log('📚 What we did:');
  console.log('   1. ✅ Created wallet from private key');
  console.log('   2. ✅ Initialized SDK components');
  console.log('   3. ✅ Retrieved signing message from API');
  console.log('   4. ✅ Authenticated with EOA client');
  console.log('   5. ✅ Verified session validity');
  console.log('   6. ✅ Logged out and invalidated session\n');

  console.log('🔗 Next Steps:');
  console.log('   - Try Base authentication: 02-base-authentication.ts');
  console.log('   - Try Smart wallet: 03-etherspot-authentication.ts');
  console.log('   - Learn session management: 04-session-management.ts');
}

// Run the example
main()
  .then(() => {
    console.log('\n✅ Process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error occurred:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      if (error.stack) {
        console.error('\n   Stack trace:');
        console.error(error.stack);
      }
    }
    process.exit(1);
  });
