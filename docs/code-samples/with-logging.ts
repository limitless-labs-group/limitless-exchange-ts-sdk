/**
 * Authentication Example with Logging
 *
 * This example demonstrates how to enable debug logging
 * to help troubleshoot integration issues.
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator, ConsoleLogger } from '@limitless-exchange/sdk';

config();

async function main() {
  console.log('🚀 Limitless Exchange SDK - Authentication with Logging\n');

  const privateKey = process.env.PRIVATE_KEY;
  if (
    !privateKey ||
    privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    throw new Error('Please set PRIVATE_KEY in .env file');
  }

  const apiUrl = process.env.API_URL || 'https://api.limitless.exchange';

  try {
    // Create wallet
    const wallet = new ethers.Wallet(privateKey);
    console.log(`Wallet address: ${wallet.address}\n`);

    // Initialize HTTP client
    const httpClient = new HttpClient({ baseURL: apiUrl });

    // Create signer
    const signer = new MessageSigner(wallet);

    // IMPORTANT: Create a logger for debugging
    // Use 'debug' level to see all SDK operations
    // Use 'info' level to see only important events
    const logger = new ConsoleLogger('debug');

    // Create authenticator WITH logger
    const authenticator = new Authenticator(httpClient, signer, logger);

    console.log('--- SDK Logs (debug level) ---\n');

    // Authenticate - you'll see detailed logs from the SDK
    const result = await authenticator.authenticate({ client: 'eoa' });

    console.log('\n--- End SDK Logs ---\n');

    console.log('✅ Authentication successful!');
    console.log(`Session: ${result.sessionCookie.substring(0, 30)}...`);
    console.log(`Account: ${result.profile.account}\n`);

    // Verify auth - more SDK logs
    console.log('--- SDK Logs (verifying) ---\n');
    const verified = await authenticator.verifyAuth(result.sessionCookie);
    console.log('\n--- End SDK Logs ---\n');

    console.log(`✅ Verified: ${verified}\n`);

    // Logout - final SDK logs
    console.log('--- SDK Logs (logout) ---\n');
    await authenticator.logout(result.sessionCookie);
    console.log('\n--- End SDK Logs ---\n');

    console.log('✅ Logged out successfully!');
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

main().catch(console.error);
