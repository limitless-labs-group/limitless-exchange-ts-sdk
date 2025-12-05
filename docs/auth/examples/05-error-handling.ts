/**
 * Authentication Error Handling Example
 *
 * This example demonstrates how to handle various authentication errors
 * and implement robust error recovery strategies.
 *
 * @example
 * ```bash
 * node 05-error-handling.ts
 * ```
 */

import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator } from '@limitless-exchange/sdk';

async function main() {
  console.log('⚠️  Authentication Error Handling Examples\n');

  // ============================================================================
  // ERROR 1: Missing Private Key
  // ============================================================================

  console.log('📝 ERROR 1: Missing Private Key\n');

  try {
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey || privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('PRIVATE_KEY environment variable required');
    }

    console.log('✅ Private key validation passed\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    console.log('💡 Solution: Set PRIVATE_KEY environment variable');
    console.log('   Example: PRIVATE_KEY=0x... node script.ts\n');
  }

  // ============================================================================
  // ERROR 2: Invalid Private Key Format
  // ============================================================================

  console.log('📝 ERROR 2: Invalid Private Key Format\n');

  try {
    const invalidKey = '0xinvalid';
    new ethers.Wallet(invalidKey);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    console.log('💡 Solution: Ensure private key is valid hex string');
    console.log('   - Must start with 0x');
    console.log('   - Must be 66 characters long (0x + 64 hex chars)');
    console.log('   - Example: 0x1234567890abcdef...\n');
  }

  // ============================================================================
  // ERROR 3: ETHERSPOT Without Smart Wallet
  // ============================================================================

  console.log('📝 ERROR 3: ETHERSPOT Without Smart Wallet\n');

  try {
    const wallet = ethers.Wallet.createRandom();
    const httpClient = new HttpClient();
    const signer = new MessageSigner(wallet);
    const authenticator = new Authenticator(httpClient, signer);

    // This will throw error
    await authenticator.authenticate({
      client: 'etherspot',
      // Missing smartWallet parameter!
    });
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    console.log('💡 Solution: Provide smartWallet address for ETHERSPOT');
    console.log('   Example:');
    console.log('   await authenticator.authenticate({');
    console.log('     client: "etherspot",');
    console.log('     smartWallet: "0x..."');
    console.log('   });\n');
  }

  // ============================================================================
  // ERROR 4: Network Timeout
  // ============================================================================

  console.log('📝 ERROR 4: Network Timeout\n');

  try {
    const wallet = ethers.Wallet.createRandom();
    const httpClient = new HttpClient({
      baseURL: 'https://invalid-url-that-does-not-exist-12345.com',
      timeout: 2000, // 2 seconds
    });
    const signer = new MessageSigner(wallet);
    const authenticator = new Authenticator(httpClient, signer);

    await authenticator.getSigningMessage();
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    console.log('💡 Solutions:');
    console.log('   1. Check internet connection');
    console.log('   2. Verify API URL is correct');
    console.log('   3. Increase timeout if on slow network:');
    console.log('      const httpClient = new HttpClient({');
    console.log('        timeout: 60000 // 60 seconds');
    console.log('      });\n');
  }

  // ============================================================================
  // ERROR 5: API Error Response
  // ============================================================================

  console.log('📝 ERROR 5: Handling API Errors\n');

  function handleAuthError(error: unknown): void {
    if (error instanceof Error) {
      const message = error.message;

      // Network errors
      if (message.includes('ECONNREFUSED')) {
        console.error('❌ Cannot connect to API');
        console.log('💡 Check if API is running and URL is correct\n');
      }
      // Timeout errors
      else if (message.includes('timeout')) {
        console.error('❌ Request timed out');
        console.log('💡 Try increasing timeout or check network connection\n');
      }
      // API errors
      else if (message.includes('API Error')) {
        console.error('❌ API returned an error');
        console.log('💡 Check API status and request parameters\n');
      }
      // Authentication errors
      else if (message.includes('signature')) {
        console.error('❌ Signature verification failed');
        console.log('💡 Ensure wallet is correct and message is properly signed\n');
      }
      // Session errors
      else if (message.includes('session cookie')) {
        console.error('❌ Failed to obtain session');
        console.log('💡 API may not have returned session cookie\n');
      }
      else {
        console.error('❌ Unknown error:', message);
        console.log('💡 Enable debug logging for more details\n');
      }
    }
  }

  // Example usage
  try {
    throw new Error('API Error 500: Internal Server Error');
  } catch (error) {
    handleAuthError(error);
  }

  // ============================================================================
  // ERROR 6: Session Verification Failed
  // ============================================================================

  console.log('📝 ERROR 6: Invalid or Expired Session\n');

  try {
    const wallet = ethers.Wallet.createRandom();
    const httpClient = new HttpClient({
      baseURL: process.env.API_URL || 'https://api.limitless.exchange',
    });
    const signer = new MessageSigner(wallet);
    const authenticator = new Authenticator(httpClient, signer);

    // Try to verify invalid session
    await authenticator.verifyAuth('invalid-session-token');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    console.log('💡 Solutions:');
    console.log('   1. Re-authenticate to get new session');
    console.log('   2. Check if session has expired');
    console.log('   3. Verify session token is correct\n');
  }

  // ============================================================================
  // BEST PRACTICE: Comprehensive Error Handling
  // ============================================================================

  console.log('📝 BEST PRACTICE: Comprehensive Error Handling\n');

  async function authenticateWithRetry(
    authenticator: Authenticator,
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}...`);

        const result = await authenticator.authenticate({ client: 'eoa' });

        console.log('✅ Authentication successful\n');
        return result;

      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Attempt ${attempt} failed:`, lastError.message);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
          console.log(`   Retrying in ${delay}ms...\n`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Authentication failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  // Test retry logic with random wallet (will fail)
  try {
    const wallet = ethers.Wallet.createRandom();
    const httpClient = new HttpClient({
      baseURL: 'https://api.limitless.exchange',
      timeout: 5000,
    });
    const signer = new MessageSigner(wallet);
    const authenticator = new Authenticator(httpClient, signer);

    // This might fail, demonstrating retry logic
    // await authenticateWithRetry(authenticator, 3);
    console.log('   (Retry example - not executed to avoid actual API calls)\n');
  } catch (error) {
    console.error('   All retry attempts failed\n');
  }

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('🎉 Error Handling Examples Completed!\n');

  console.log('📚 Common Errors & Solutions:\n');

  console.log('1️⃣  Missing/Invalid Private Key');
  console.log('   → Validate environment variables');
  console.log('   → Check key format (0x + 64 hex chars)\n');

  console.log('2️⃣  ETHERSPOT Without Smart Wallet');
  console.log('   → Always provide smartWallet for ETHERSPOT');
  console.log('   → Validate addresses before authenticating\n');

  console.log('3️⃣  Network Errors');
  console.log('   → Check API URL and connectivity');
  console.log('   → Increase timeout for slow networks');
  console.log('   → Implement retry logic with exponential backoff\n');

  console.log('4️⃣  API Errors');
  console.log('   → Parse error messages for specific issues');
  console.log('   → Enable debug logging for details');
  console.log('   → Check API status page\n');

  console.log('5️⃣  Session Errors');
  console.log('   → Verify session before use');
  console.log('   → Re-authenticate on verification failure');
  console.log('   → Implement session refresh logic\n');

  console.log('💡 Best Practices:');
  console.log('   ✅ Always validate input parameters');
  console.log('   ✅ Implement proper error handling');
  console.log('   ✅ Use try-catch blocks');
  console.log('   ✅ Provide helpful error messages');
  console.log('   ✅ Log errors for debugging');
  console.log('   ✅ Implement retry logic for network errors');
  console.log('   ✅ Handle different error types appropriately');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
