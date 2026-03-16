/**
 * Numeric parsing helpers for API payloads that may return numbers as strings.
 */

/**
 * Converts number-like values to finite numbers.
 * Returns undefined when value is not numeric.
 */
export function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

/**
 * Converts number-like values to finite integers.
 * Returns undefined when value is not an integer.
 */
export function toFiniteInteger(value: unknown): number | undefined {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined) {
    return undefined;
  }

  return Number.isInteger(parsed) ? parsed : undefined;
}

