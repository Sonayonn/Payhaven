import { NextRequest } from "next/server";
import { address, createSolanaRpc } from "@solana/kit";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { env } from "@/lib/env";
import { USDC_MAINNET_MINT } from "@/lib/umbra/constants";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { ensureSenderWallet } from "@/lib/privy/sender-wallet";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return apiError("UNAUTHORIZED", "Missing Authorization header");
  }

  let identity;
  try {
    identity = await verifyPrivyTokenAndGetIdentifiers(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  let wallet;
  try {
    // Pass linked email/phone so first-login adoption can find a wallet
    // pregenerated for this user before they ever signed up.
    wallet = await ensureSenderWallet(identity.privyUserId, {
      email: identity.email,
      phone: identity.phone,
    });
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to resolve sender wallet", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }

  let usdcBalance = "0";
  const rpc = createSolanaRpc(env.SOLANA_RPC_URL);

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await rpc
        .getTokenAccountsByOwner(
          address(wallet.solanaAddress),
          { mint: USDC_MAINNET_MINT },
          { encoding: "jsonParsed" },
        )
        .send();

      const firstAccount = response.value[0];
      if (firstAccount) {
        const parsed = firstAccount.account.data as unknown as {
          parsed: { info: { tokenAmount: { amount: string } } };
        };
        usdcBalance = parsed.parsed.info.tokenAmount.amount;
      }
      break;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        log.warn("Failed to fetch USDC balance after retries, returning 0", {
          err: err instanceof Error ? err.message : String(err),
          attempt,
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  return Response.json({
    ok: true,
    solanaAddress: wallet.solanaAddress,
    usdcBalanceBaseUnits: usdcBalance,
  });
}