/**
 * Authentication Example
 *
 * This example demonstrates how to authenticate with the Limitless Exchange API
 * using the SDK.
 */

import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator } from '../../../src';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  const wallet = new ethers.Wallet(privateKey);
  console.log(`Using wallet address: ${wallet.address}`);

  const httpClient = new HttpClient({
    baseURL: 'https://api.limitless.exchange',
  });

  const signer = new MessageSigner(wallet);
  const authenticator = new Authenticator(httpClient, signer);

  console.log('\n1. Getting signing message...');
  const message = await authenticator.getSigningMessage();
  console.log(`Signing message received: ${message.substring(0, 50)}...`);

  console.log('\n2. Authenticating with EOA...');
  const result = await authenticator.authenticate({
    client: 'eoa',
  });

  console.log('Authentication successful!');
  console.log(`Session cookie: ${result.sessionCookie.substring(0, 20)}...`);
  console.log(`Profile:`, result.profile);
  console.log(`Mode:`, result.mode);

  console.log('\n3. Verifying authentication...');
  const address = await authenticator.verifyAuth(result.sessionCookie);
  console.log(`Verified address: ${address}`);

  console.log('\n4. Logging out...');
  await authenticator.logout(result.sessionCookie);
  console.log('Logged out successfully!');
}

main()
  .then(() => {
    console.log('\nExample completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nError:', error.message);
    process.exit(1);
  });
