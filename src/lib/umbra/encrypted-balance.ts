import "server-only";
import { getEncryptedBalanceQuerierFunction } from "@umbra-privacy/sdk";
import { address } from "@solana/kit";
import { getPrivyUmbraClient } from "./privy-umbra-client";
import { USDC_MAINNET_MINT } from "./constants";
import { log } from "@/lib/log";

/**
 * Query a user's encrypted USDC balance.
 *
 * Returns the decrypted balance in base units (USDC has 6 decimals — 1 USDC = 1_000_000 base units).
 *
 * State semantics from Umbra docs:
 *   - "non_existent": user has never deposited; encrypted account doesn't exist yet
 *   - "uninitialized": account exists but Arcium hasn't initialized the balance
 *   - "mxe": MXE-only mode, cannot decrypt client-side (shouldn't happen for our flow
 *           since we register with X25519 → Shared mode)
 *   - "shared": Shared mode, balance decrypted and returned as bigint
 *
 * For Payhaven UX, anything that's not "shared" with a non-zero balance shows as $0.00.
 * The deposit/shield flow transitions: non_existent → shared.
 *
 * Read-only — no signing prompt, no transaction, ~500ms RPC roundtrip.
 */
export async function getEncryptedUsdcBalance(params: {
  walletId: string;
  address: string;
}): Promise<{
  state: "non_existent" | "uninitialized" | "mxe" | "shared";
  balanceBaseUnits: bigint;
}> {
  const client = await getPrivyUmbraClient({
    walletId: params.walletId,
    address: params.address,
  });

  const query = getEncryptedBalanceQuerierFunction({ client });

  // Query a single mint (USDC). The function takes Address[] and returns
  // Map<Address, QueryEncryptedBalanceResult>.
  const usdcMintAddr = address(USDC_MAINNET_MINT);
  const balances = await query([usdcMintAddr]);

  const result = balances.get(usdcMintAddr);

  if (!result) {
    log.warn("Encrypted balance query returned no entry for USDC", {
      address: params.address,
    });
    return { state: "non_existent", balanceBaseUnits: 0n };
  }

  switch (result.state) {
    case "shared":
      return {
        state: "shared",
        balanceBaseUnits: BigInt(result.balance.toString()),
      };
    case "mxe":
    case "uninitialized":
    case "non_existent":
      return { state: result.state, balanceBaseUnits: 0n };
  }
}