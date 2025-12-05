/**
 * Authentication with Debug Logging Example
 *
 * This example demonstrates how to enable debug logging
 * to troubleshoot authentication issues and monitor SDK operations.
 *
 * @example
 * ```bash
 * PRIVATE_KEY=0x... node 06-with-logging.ts
 * ```
 */

import { ethers } from 'ethers';
import {
  HttpClient,
  MessageSigner,
  Authenticator,
  ConsoleLogger,
  ILogger,
} from '@limitless-exchange/sdk';

async function main() {
  console.log('🔍 Authentication with Debug Logging Example\n');

  // ============================================================================
  // STEP 1: Setup with Logging
  // ============================================================================

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable required');
  }

  const wallet = new ethers.Wallet(privateKey);

  // Create HTTP client
  const httpClient = new HttpClient({
    baseURL: process.env.API_URL || 'https://api.limitless.exchange',
  });

  const signer = new MessageSigner(wallet);

  // ============================================================================
  // STEP 2: Create Logger
  // ============================================================================

  console.log('📋 Available Log Levels:\n');
  console.log('   - debug: Verbose, shows all SDK operations');
  console.log('   - info:  Important events only');
  console.log('   - warn:  Warnings and errors');
  console.log('   - error: Errors only\n');

  // Create logger with debug level
  const logger: ILogger = new ConsoleLogger('debug');

  console.log('✅ Using debug level logger\n');

  // Create authenticator with logger
  const authenticator = new Authenticator(httpClient, signer, logger);

  // ============================================================================
  // STEP 3: Authenticate (with logs)
  // ============================================================================

  console.log('─'.repeat(60));
  console.log('SDK DEBUG LOGS START');
  console.log('─'.repeat(60));
  console.log();

  const result = await authenticator.authenticate({
    client: 'eoa',
  });

  console.log();
  console.log('─'.repeat(60));
  console.log('SDK DEBUG LOGS END');
  console.log('─'.repeat(60));
  console.log();

  // ============================================================================
  // STEP 4: Verify (with logs)
  // ============================================================================

  console.log('🔍 Verifying session...\n');

  console.log('─'.repeat(60));
  console.log('SDK DEBUG LOGS START');
  console.log('─'.repeat(60));
  console.log();

  const verified = await authenticator.verifyAuth(result.sessionCookie);

  console.log();
  console.log('─'.repeat(60));
  console.log('SDK DEBUG LOGS END');
  console.log('─'.repeat(60));
  console.log();

  console.log(`✅ Verified: ${verified}\n`);

  // ============================================================================
  // STEP 5: Logout (with logs)
  // ============================================================================

  console.log('👋 Logging out...\n');

  console.log('─'.repeat(60));
  console.log('SDK DEBUG LOGS START');
  console.log('─'.repeat(60));
  console.log();

  await authenticator.logout(result.sessionCookie);

  console.log();
  console.log('─'.repeat(60));
  console.log('SDK DEBUG LOGS END');
  console.log('─'.repeat(60));
  console.log();

  // ============================================================================
  // STEP 6: Compare Log Levels
  // ============================================================================

  console.log('📊 Comparing Different Log Levels\n');

  console.log('1️⃣  INFO Level (less verbose):\n');
  const infoLogger = new ConsoleLogger('info');
  const authWithInfo = new Authenticator(httpClient, signer, infoLogger);

  console.log('─── INFO Level Logs ───');
  await authWithInfo.getSigningMessage();
  console.log('─── End ───\n');

  console.log('2️⃣  DEBUG Level (more verbose):\n');
  const debugLogger = new ConsoleLogger('debug');
  const authWithDebug = new Authenticator(httpClient, signer, debugLogger);

  console.log('─── DEBUG Level Logs ───');
  await authWithDebug.getSigningMessage();
  console.log('─── End ───\n');

  // ============================================================================
  // STEP 7: Custom Logger Example
  // ============================================================================

  console.log('🎨 Custom Logger Example\n');

  class CustomLogger implements ILogger {
    private prefix = '[My App]';

    debug(message: string, meta?: Record<string, any>): void {
      console.log(`${this.prefix} 🐛 DEBUG:`, message, meta || '');
    }

    info(message: string, meta?: Record<string, any>): void {
      console.log(`${this.prefix} ℹ️  INFO:`, message, meta || '');
    }

    warn(message: string, meta?: Record<string, any>): void {
      console.log(`${this.prefix} ⚠️  WARN:`, message, meta || '');
    }

    error(message: string, error?: Error, meta?: Record<string, any>): void {
      console.log(`${this.prefix} ❌ ERROR:`, message, error, meta || '');
    }
  }

  const customLogger = new CustomLogger();
  const authWithCustom = new Authenticator(httpClient, signer, customLogger);

  console.log('─── Custom Logger Output ───');
  await authWithCustom.getSigningMessage();
  console.log('─── End ───\n');

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('🎉 Logging Example Completed!\n');

  console.log('📚 What You Learned:\n');
  console.log('   ✅ How to enable debug logging');
  console.log('   ✅ Different log levels (debug, info, warn, error)');
  console.log('   ✅ What information is logged at each level');
  console.log('   ✅ How to create custom loggers');
  console.log('   ✅ When to use each log level\n');

  console.log('💡 When to Use Logging:\n');
  console.log('   🔧 Development:');
  console.log('      → Use ConsoleLogger with debug level');
  console.log('      → See all SDK operations');
  console.log('      → Troubleshoot integration issues\n');

  console.log('   🚀 Production:');
  console.log('      → Use custom logger (Winston, Pino)');
  console.log('      → Use info or warn level');
  console.log('      → Send logs to monitoring service\n');

  console.log('   🧪 Testing:');
  console.log('      → Use no logger (default)');
  console.log('      → Or mock logger to test log calls');
  console.log('      → Keep test output clean\n');

  console.log('🔗 Learn More:');
  console.log('   - Production logging: ../LOGGING.md');
  console.log('   - Winston integration: ../LOGGING.md#winston-example');
  console.log('   - Custom loggers: ../LOGGING.md#logger-interface');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
