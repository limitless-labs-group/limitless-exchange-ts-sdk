/**
 * Error Handling Example
 *
 * This example demonstrates proper error handling patterns
 * when using the Limitless Exchange SDK.
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator } from '@limitless-exchange/sdk';

config();

async function main() {
  console.log('🚀 Limitless Exchange SDK - Error Handling Patterns\n');

  // Example 1: Invalid private key
  console.log('📝 Example 1: Handling invalid private key...');
  try {
    const invalidWallet = new ethers.Wallet('0xinvalid');
    console.log('   ❌ Should have thrown an error');
  } catch (error) {
    console.log('   ✅ Caught error:', error instanceof Error ? error.message : error);
  }
  console.log();

  // Example 2: Network timeout
  console.log('📝 Example 2: Network timeout handling...');
  try {
    const wallet = ethers.Wallet.createRandom();
    const httpClient = new HttpClient({
      baseURL: 'https://invalid-api-url-that-does-not-exist.com',
      timeout: 1000, // 1 second timeout
    });
    const signer = new MessageSigner(wallet);
    const authenticator = new Authenticator(httpClient, signer);

    await authenticator.getSigningMessage();
    console.log('   ❌ Should have thrown an error');
  } catch (error) {
    console.log('   ✅ Caught network error:', error instanceof Error ? error.message : error);
  }
  console.log();

  // Example 3: Proper error handling pattern
  console.log('📝 Example 3: Recommended error handling pattern...');

  const privateKey = process.env.PRIVATE_KEY;
  if (
    !privateKey ||
    privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    console.log('   ⚠️  Skipping - PRIVATE_KEY not configured\n');
    return;
  }

  try {
    const wallet = new ethers.Wallet(privateKey);
    const httpClient = new HttpClient({
      baseURL: process.env.API_URL || 'https://api.limitless.exchange',
      timeout: 30000,
    });
    const signer = new MessageSigner(wallet);
    const authenticator = new Authenticator(httpClient, signer);

    const result = await authenticator.authenticate({ client: 'eoa' });
    console.log('   ✅ Authentication successful');
    console.log(`   Address: ${result.profile.account}\n`);

    // Clean up
    await authenticator.logout(result.sessionCookie);
  } catch (error) {
    // Detailed error handling
    if (error instanceof Error) {
      console.log('   ❌ Error type:', error.constructor.name);
      console.log('   ❌ Message:', error.message);

      // Handle specific error patterns
      if (error.message.includes('API Error')) {
        console.log('   💡 Suggestion: Check API endpoint and network connection');
      } else if (error.message.includes('timeout')) {
        console.log('   💡 Suggestion: Increase timeout or check network');
      } else if (error.message.includes('signature')) {
        console.log('   💡 Suggestion: Verify wallet private key');
      }
    }
  }
  console.log();

  console.log('🎉 Error handling examples completed!');
  console.log('\n💡 Best Practices:');
  console.log('   1. Always use try-catch blocks for async operations');
  console.log('   2. Check error types and messages for specific handling');
  console.log('   3. Validate inputs before SDK calls');
  console.log('   4. Set appropriate timeouts for network operations');
  console.log('   5. Clean up resources (logout) in finally blocks');
}

main().catch(console.error);
