/**
 * Basic Authentication Example
 *
 * This example demonstrates how to use the locally built SDK
 * for basic EOA (Externally Owned Account) authentication.
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator } from '@limitless-exchange/sdk';
import { ConsoleLogger } from '@limitless-exchange/sdk';
// Load environment variables
config();

async function main() {
  console.log('🚀 Limitless Exchange SDK - Basic Authentication Example\n');
  const logger = new ConsoleLogger('debug');
  // Validate environment
  const privateKey = process.env.PRIVATE_KEY;
  if (
    !privateKey ||
    privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    throw new Error(
      'Please set PRIVATE_KEY in .env file\n' + 'Copy .env.example to .env and add your private key'
    );
  }

  const apiUrl = process.env.API_URL || 'https://api.limitless.exchange';

  try {
    // Step 1: Create wallet
    console.log('📝 Step 1: Creating wallet from private key...');
    const wallet = new ethers.Wallet(privateKey);
    console.log(`   Wallet address: ${wallet.address}\n`);

    // Step 2: Initialize HTTP client
    console.log('🌐 Step 2: Initializing HTTP client...');
    const httpClient = new HttpClient({
      baseURL: apiUrl,
      timeout: 30000,
    });
    console.log(`   API URL: ${apiUrl}\n`);

    // Step 3: Initialize signer and authenticator
    console.log('🔐 Step 3: Setting up authentication...');
    const signer = new MessageSigner(wallet);
    const authenticator = new Authenticator(httpClient, signer);
    console.log('   Signer and authenticator ready\n');

    // Step 4: Get signing message
    console.log('📨 Step 4: Requesting signing message from API...');
    const signingMessage = await authenticator.getSigningMessage();
    console.log(`   Message: ${signingMessage.substring(0, 60)}...\n`);

    // Step 5: Authenticate
    console.log('✍️  Step 5: Signing and authenticating...');
    const result = await authenticator.authenticate({
      client: 'etherspot',
    });
    console.log('   ✅ Authentication successful!');
    console.log(`   Session cookie: ${result.sessionCookie.substring(0, 30)}...`);
    console.log(`   Profile:`, {
      account: result.profile.account,
      displayName: result.profile.displayName,
      client: result.profile.client,
    });
    console.log();

    // Step 6: Verify authentication
    console.log('🔍 Step 6: Verifying authentication...');
    const verifiedAddress = await authenticator.verifyAuth(result.sessionCookie);
    console.log(`   ✅ Verified address: ${verifiedAddress}\n`);

    // Step 7: Logout
    console.log('👋 Step 7: Logging out...');
    await authenticator.logout(result.sessionCookie);
    console.log('   ✅ Logged out successfully\n');

    console.log('🎉 All steps completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('   - Try the smart wallet example: pnpm start:smart-wallet');
    console.log('   - Explore error handling: pnpm start:error-handling');
  } catch (error) {
    console.error('\n❌ Error occurred');

    // Check if it's an APIError with raw response data
    if (error && typeof error === 'object' && 'status' in error && 'data' in error) {
      console.error('   Status:', (error as any).status);
      console.error('   Message:', (error as any).message);
      console.error('   URL:', (error as any).url);
      console.error('   Method:', (error as any).method);
      console.error('   Raw API Response:', JSON.stringify((error as any).data, null, 2));
    } else if (error instanceof Error) {
      console.error('   Message:', error.message);
    } else {
      console.error('   Unknown error:', error);
    }

    // Only show stack trace in debug mode
    if (process.env.DEBUG === 'true' && error instanceof Error && error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the example
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
