/**
 * Session Management Example
 *
 * This example demonstrates how to manage authentication sessions:
 * - Creating sessions
 * - Storing session tokens
 * - Reusing sessions
 * - Session validation
 * - Handling expired sessions
 *
 * @example
 * ```bash
 * PRIVATE_KEY=0x... node 04-session-management.ts
 * ```
 */

import { ethers } from 'ethers';
import { HttpClient, MessageSigner, Authenticator } from '@limitless-exchange/sdk';

// Simple session storage (in-memory)
// In production, use secure storage (database, Redis, etc.)
interface SessionStore {
  token: string | null;
  expiresAt: number | null;
  address: string | null;
}

const sessionStore: SessionStore = {
  token: null,
  expiresAt: null,
  address: null,
};

async function main() {
  console.log('🔐 Session Management Example\n');

  // ============================================================================
  // Setup
  // ============================================================================

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable required');
  }

  const wallet = new ethers.Wallet(privateKey);
  const httpClient = new HttpClient({
    baseURL: process.env.API_URL || 'https://api.limitless.exchange',
  });
  const signer = new MessageSigner(wallet);
  const authenticator = new Authenticator(httpClient, signer);

  console.log(`Wallet: ${wallet.address}\n`);

  // ============================================================================
  // SCENARIO 1: First-Time Authentication
  // ============================================================================

  console.log('📝 SCENARIO 1: First-Time Authentication\n');

  if (!sessionStore.token) {
    console.log('No existing session found, authenticating...');

    const result = await authenticator.authenticate({ client: 'eoa' });

    // Store session
    sessionStore.token = result.sessionCookie;
    sessionStore.address = result.profile.account;
    sessionStore.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    console.log('✅ Session created and stored');
    console.log(`   Token: ${sessionStore.token.substring(0, 30)}...`);
    console.log(`   Address: ${sessionStore.address}`);
    console.log(`   Expires: ${new Date(sessionStore.expiresAt).toLocaleString()}\n`);
  }

  // ============================================================================
  // SCENARIO 2: Reusing Existing Session
  // ============================================================================

  console.log('📝 SCENARIO 2: Reusing Existing Session\n');

  if (sessionStore.token && Date.now() < (sessionStore.expiresAt || 0)) {
    console.log('Existing session found, verifying...');

    try {
      const verified = await authenticator.verifyAuth(sessionStore.token);

      console.log('✅ Session is still valid');
      console.log(`   Verified address: ${verified}`);
      console.log(`   Matches stored: ${verified === sessionStore.address ? '✅' : '❌'}\n`);

      // Set session in HTTP client for subsequent requests
      httpClient.setSessionCookie(sessionStore.token);
      console.log('✅ Session token set in HTTP client');
      console.log('   All API requests will now be authenticated\n');

    } catch (error) {
      console.error('❌ Session verification failed');
      console.error('   Session may be expired or invalid');
      console.error('   Re-authenticating...\n');

      // Clear invalid session
      sessionStore.token = null;
      sessionStore.expiresAt = null;
      sessionStore.address = null;

      // Re-authenticate
      const result = await authenticator.authenticate({ client: 'eoa' });
      sessionStore.token = result.sessionCookie;
      sessionStore.address = result.profile.account;
      sessionStore.expiresAt = Date.now() + (24 * 60 * 60 * 1000);

      console.log('✅ Re-authenticated successfully\n');
    }
  }

  // ============================================================================
  // SCENARIO 3: Session Expiration Check
  // ============================================================================

  console.log('📝 SCENARIO 3: Session Expiration Check\n');

  function isSessionValid(store: SessionStore): boolean {
    if (!store.token || !store.expiresAt) {
      return false;
    }

    if (Date.now() >= store.expiresAt) {
      console.log('⚠️  Session expired');
      return false;
    }

    return true;
  }

  if (isSessionValid(sessionStore)) {
    const remainingTime = Math.floor(((sessionStore.expiresAt || 0) - Date.now()) / 1000);
    const hours = Math.floor(remainingTime / 3600);
    const minutes = Math.floor((remainingTime % 3600) / 60);

    console.log('✅ Session is valid');
    console.log(`   Time remaining: ${hours}h ${minutes}m\n`);
  } else {
    console.log('❌ Session is invalid or expired\n');
  }

  // ============================================================================
  // SCENARIO 4: Multiple Sessions (Different Wallets)
  // ============================================================================

  console.log('📝 SCENARIO 4: Multiple Sessions\n');

  interface MultiSessionStore {
    [address: string]: {
      token: string;
      expiresAt: number;
    };
  }

  const multiSessionStore: MultiSessionStore = {};

  // Helper function to get or create session
  async function getSession(
    walletAddress: string,
    wallet: ethers.Wallet
  ): Promise<string> {
    // Check if session exists and is valid
    const existing = multiSessionStore[walletAddress];
    if (existing && Date.now() < existing.expiresAt) {
      console.log(`   Using existing session for ${walletAddress}`);
      return existing.token;
    }

    // Create new session
    console.log(`   Creating new session for ${walletAddress}`);
    const signer = new MessageSigner(wallet);
    const auth = new Authenticator(httpClient, signer);
    const result = await auth.authenticate({ client: 'eoa' });

    multiSessionStore[walletAddress] = {
      token: result.sessionCookie,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000),
    };

    return result.sessionCookie;
  }

  // Example: Managing sessions for current wallet
  const currentSession = await getSession(wallet.address, wallet);
  console.log(`✅ Session ready for ${wallet.address.substring(0, 10)}...`);
  console.log(`   Token: ${currentSession.substring(0, 30)}...\n`);

  // ============================================================================
  // SCENARIO 5: Explicit Logout
  // ============================================================================

  console.log('📝 SCENARIO 5: Explicit Logout\n');

  if (sessionStore.token) {
    console.log('Logging out current session...');

    await authenticator.logout(sessionStore.token);

    // Clear session storage
    sessionStore.token = null;
    sessionStore.expiresAt = null;
    sessionStore.address = null;

    // Clear from HTTP client
    httpClient.clearSessionCookie();

    console.log('✅ Session logged out and cleared');
    console.log('   Token is now invalid on the server');
    console.log('   Local session data cleared\n');
  }

  // ============================================================================
  // Best Practices Summary
  // ============================================================================

  console.log('🎉 Session Management Examples Completed!\n');

  console.log('📚 Best Practices:');
  console.log('   ✅ Store session tokens securely');
  console.log('   ✅ Check expiration before using');
  console.log('   ✅ Verify session validity with API');
  console.log('   ✅ Handle expired sessions gracefully');
  console.log('   ✅ Clear sessions on logout');
  console.log('   ✅ Use separate sessions for different wallets');
  console.log();

  console.log('🔒 Security Reminders:');
  console.log('   ❌ Never store tokens in localStorage (XSS risk)');
  console.log('   ❌ Never commit tokens to version control');
  console.log('   ❌ Never log full tokens in production');
  console.log('   ✅ Use httpOnly cookies when possible');
  console.log('   ✅ Use secure session storage (Redis, database)');
  console.log('   ✅ Implement session rotation');
  console.log();

  console.log('💡 Production Storage Options:');
  console.log('   - Backend: Redis, PostgreSQL, MongoDB');
  console.log('   - Frontend: Memory only (re-auth on refresh)');
  console.log('   - Mobile: Secure Keychain/Keystore');
  console.log('   - Server: Environment variables, Secrets Manager');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
