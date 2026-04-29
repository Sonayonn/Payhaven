import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { ensureSenderWallet } from "@/lib/privy/sender-wallet";
import { insertViewingKeyGrant } from "@/lib/viewing-keys/server";
import { deriveAuditPackage, USDC_MAINNET_MINT } from "@/lib/viewing-keys/derive";

const requestSchema = z
  .object({
    startYear: z.number().int().min(2024).max(2100),
    startMonth: z.number().int().min(1).max(12),
    endYear: z.number().int().min(2024).max(2100),
    endMonth: z.number().int().min(1).max(12),
    label: z.string().max(120).nullable().optional(),
    mintAddress: z.string().optional(),
  })
  .refine(
    (v) =>
      v.endYear > v.startYear ||
      (v.endYear === v.startYear && v.endMonth >= v.startMonth),
    { message: "End date must be on or after start date" },
  );

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return apiError("UNAUTHORIZED", "Missing Authorization header");

  let identity;
  try {
    identity = await verifyPrivyTokenAndGetIdentifiers(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Request body must be valid JSON");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "Invalid request body", {
      logFields: { issues: parsed.error.issues },
    });
  }

  const {
    startYear,
    startMonth,
    endYear,
    endMonth,
    label,
    mintAddress: mintInput,
  } = parsed.data;
  const mintAddress = mintInput ?? USDC_MAINNET_MINT;

  let wallet;
  try {
    wallet = await ensureSenderWallet(identity.privyUserId, {
      email: identity.email,
      phone: identity.phone,
    });
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to resolve wallet", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }

  let derivation;
  try {
    derivation = await deriveAuditPackage({
      walletId: wallet.walletId,
      walletAddress: wallet.solanaAddress,
      mintAddress,
      startYear,
      startMonth,
      endYear,
      endMonth,
    });
  } catch (err) {
    log.error("Viewing key derivation failed", {
      address: wallet.solanaAddress,
      err: err instanceof Error ? err.message : String(err),
    });
    return apiError("UPSTREAM_ERROR", "Failed to derive viewing keys");
  }

  let grant;
  try {
    grant = await insertViewingKeyGrant({
      privyUserId: identity.privyUserId,
      mintAddress,
      startYear,
      startMonth,
      endYear,
      endMonth,
      label: label ?? null,
    });
  } catch (err) {
    log.error("Grant persistence failed, package generated but not recorded", {
      err: err instanceof Error ? err.message : String(err),
    });
    return apiError("INTERNAL_ERROR", "Failed to record grant");
  }

  return Response.json({
    ok: true,
    grantId: grant.id,
    auditPackage: derivation.pkg,
    monthCount: derivation.monthCount,
  });
}