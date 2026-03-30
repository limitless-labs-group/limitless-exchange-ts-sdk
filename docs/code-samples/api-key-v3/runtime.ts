import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SavedDelegatedAccount {
  partnerName: string;
  marketSlug: string;
  profileId: number;
  account: string;
  exchangeAddress: string;
  collateralTokenAddress: string;
  collateralTokenSymbol?: string;
  collateralTokenDecimals?: number;
  createdAt: string;
  derivedTokenId?: string;
  derivedTokenSecret?: string;
  derivedTokenApiKey?: string;
  derivedTokenCreatedAt?: string;
}

const sampleDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = path.join(sampleDir, '.runtime');
const runtimeFile = path.join(runtimeDir, 'delegated-accounts.json');

async function loadAll(): Promise<SavedDelegatedAccount[]> {
  try {
    const raw = await readFile(runtimeFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedDelegatedAccount[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function saveAll(accounts: SavedDelegatedAccount[]): Promise<void> {
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(runtimeFile, `${JSON.stringify(accounts, null, 2)}\n`, 'utf8');
}

function matchesAccount(
  account: SavedDelegatedAccount,
  partnerName: string,
  marketSlug: string,
  exchangeAddress: string,
  collateralTokenAddress: string,
): boolean {
  return (
    account.partnerName === partnerName &&
    account.marketSlug === marketSlug &&
    account.exchangeAddress.toLowerCase() === exchangeAddress.toLowerCase() &&
    account.collateralTokenAddress.toLowerCase() === collateralTokenAddress.toLowerCase()
  );
}

export async function findSavedDelegatedAccount(
  partnerName: string,
  marketSlug: string,
  exchangeAddress: string,
  collateralTokenAddress: string,
): Promise<SavedDelegatedAccount | undefined> {
  const accounts = await loadAll();
  return accounts.find((account) =>
    matchesAccount(account, partnerName, marketSlug, exchangeAddress, collateralTokenAddress),
  );
}

export async function persistDelegatedAccount(account: SavedDelegatedAccount): Promise<void> {
  const accounts = await loadAll();
  const index = accounts.findIndex((candidate) =>
    matchesAccount(
      candidate,
      account.partnerName,
      account.marketSlug,
      account.exchangeAddress,
      account.collateralTokenAddress,
    ),
  );

  if (index >= 0) {
    accounts[index] = account;
  } else {
    accounts.push(account);
  }

  await saveAll(accounts);
}

export function hasSavedDerivedToken(account: SavedDelegatedAccount): boolean {
  return Boolean(account.derivedTokenId && account.derivedTokenSecret);
}
