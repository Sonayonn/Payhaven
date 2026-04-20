import { address } from "@solana/kit";

export function isValidSolanaAddress(value: string): boolean {
  try {
    address(value);
    return true;
  } catch {
    return false;
  }
}