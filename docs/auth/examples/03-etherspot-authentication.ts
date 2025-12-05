/**
 * ETHERSPOT (Smart Wallet) Authentication Example
 *
 * This example demonstrates authentication using a smart wallet (Account Abstraction).
 * Smart wallets enable gasless transactions, social recovery, and advanced features.
 *
 * Requirements:
 * - EOA wallet (to control the smart wallet)
 * - Smart wallet address
 *
 * @example
 * ```bash
 * PRIVATE_KEY=0x... SMART_WALLET_ADDRESS=0x... node 03-etherspot-authentication.ts
 * ```
 */

import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator } from '@limitless/exchange-ts-sdk';

async function main() {
  console.log('🔮 ETHERSPOT Smart Wallet Authentication Example\n');

  // ============================================================================
  // STEP 1: Setup EOA and Smart Wallet
  // ============================================================================

  const privateKey = process.env.PRIVATE_KEY;
  const smartWalletAddress = process.env.SMART_WALLET_ADDRESS;

  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable required');
  }

  if (!smartWalletAddress) {
    console.error('❌ SMART_WALLET_ADDRESS environment variable required\n');
    console.log('Smart wallet setup:');
    console.log('   1. Create smart wallet at https://etherspot.io');
    console.log('   2. Get your smart wallet address');
    console.log('   3. Set SMART_WALLET_ADDRESS=0x...\n');
    throw new Error('SMART_WALLET_ADDRESS required for ETHERSPOT authentication');
  }

  // Create EOA wallet (controls the smart wallet)
  const eoaWallet = new ethers.Wallet(privateKey);

  console.log('✅ Wallets configured');
  console.log(`   EOA Address: ${eoaWallet.address}`);
  console.log(`   Smart Wallet: ${smartWalletAddress}\n`);

  // ============================================================================
  // STEP 2: Initialize SDK
  // ============================================================================

  const httpClient = new HttpClient({
    baseURL: process.env.API_URL || 'https://api.limitless.exchange',
  });

  const signer = new MessageSigner(eoaWallet);
  const authenticator = new Authenticator(httpClient, signer);

  console.log('✅ SDK initialized\n');

  // ============================================================================
  // STEP 3: Authenticate with ETHERSPOT
  // ============================================================================

  console.log('🔑 Authenticating with ETHERSPOT client...');
  console.log('   ⚠️  Smart wallet address is REQUIRED for ETHERSPOT\n');

  const result = await authenticator.authenticate({
    client: 'etherspot',          // Specify ETHERSPOT client type
    smartWallet: smartWalletAddress, // REQUIRED for ETHERSPOT
  });

  console.log('✅ ETHERSPOT authentication successful!\n');

  // ============================================================================
  // STEP 4: Display Results
  // ============================================================================

  console.log('📋 Session Information:');
  console.log(`   Token: ${result.sessionCookie.substring(0, 30)}...`);
  console.log();

  console.log('👤 User Profile:');
  console.log(`   EOA Account: ${result.profile.account}`);
  console.log(`   Smart Wallet: ${result.profile.smartWallet}`); // Smart wallet address
  console.log(`   Display Name: ${result.profile.displayName}`);
  console.log(`   Client Type: ${result.profile.client}`); // Should be 'etherspot'
  console.log();

  // Verify addresses
  console.log('🔍 Address Verification:');
  console.log(`   EOA matches: ${result.profile.account === eoaWallet.address ? '✅' : '❌'}`);
  console.log(`   Smart Wallet matches: ${result.profile.smartWallet === smartWalletAddress ? '✅' : '❌'}`);
  console.log();

  // ============================================================================
  // STEP 5: Smart Wallet Benefits
  // ============================================================================

  console.log('💡 Smart Wallet Benefits:');
  console.log('   ✅ Gasless transactions (sponsor pays gas)');
  console.log('   ✅ Social recovery (recover wallet with guardians)');
  console.log('   ✅ Multi-signature support');
  console.log('   ✅ Batch transactions (multiple ops in one tx)');
  console.log('   ✅ Custom transaction logic');
  console.log();

  // ============================================================================
  // STEP 6: Verify and Logout
  // ============================================================================

  console.log('🔍 Verifying session...');
  const verified = await authenticator.verifyAuth(result.sessionCookie);
  console.log(`✅ Verified EOA: ${verified}`);
  console.log(`   (Session is linked to EOA, not smart wallet)\n`);

  console.log('👋 Logging out...');
  await authenticator.logout(result.sessionCookie);
  console.log('✅ Logged out\n');

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('🎉 ETHERSPOT authentication example completed!\n');
  console.log('📚 Key Points:');
  console.log('   - Smart wallet address is REQUIRED for ETHERSPOT');
  console.log('   - EOA wallet controls the smart wallet');
  console.log('   - Profile includes both EOA and smart wallet addresses');
  console.log('   - Session is authenticated via EOA signature');
  console.log('   - API requests can use smart wallet for transactions\n');

  console.log('🔗 Learn More:');
  console.log('   - Etherspot: https://etherspot.io');
  console.log('   - Account Abstraction: https://eips.ethereum.org/EIPS/eip-4337');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
    }
    process.exit(1);
  });
