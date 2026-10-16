import { getRandomBytes } from "expo-crypto";

// 32 symbols, no 0/O/1/I/L, so a code is easy to read out and type. 16 symbols = 80 bits.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 16;

/** A random backup code like `K7QM2XTA9PLD4WNE`. */
export function generateBackupCode(): string {
  const bytes = getRandomBytes(CODE_LENGTH * 2);
  let code = "";
  // Rejection sampling keeps every symbol equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  for (let i = 0; i < bytes.length && code.length < CODE_LENGTH; i++) {
    if (bytes[i] < limit) code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  // Astronomically unlikely to run short; top up if it ever does.
  while (code.length < CODE_LENGTH) {
    const [byte] = getRandomBytes(1);
    if (byte < limit) code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}

/** `K7QM2XTA9PLD4WNE` -> `K7QM-2XTA-9PLD-4WNE` for display. */
export const formatBackupCode = (code: string) => code.match(/.{1,4}/g)?.join("-") ?? code;

/**
 * Cleans what a person typed or pasted (case, spaces, dashes) into the stored form.
 * Returns null when it can't be a valid code.
 */
export function normalizeBackupCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  if (cleaned.length !== CODE_LENGTH) return null;
  for (const char of cleaned) if (!ALPHABET.includes(char)) return null;
  return cleaned;
}
