import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { validateAndClaimInvite } from "@/lib/invite-codes/server";

const requestSchema = z.object({
  code: z.string().min(3).max(64),
});

const COOKIE_NAME = "payhaven_verified";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

/**
 * POST /api/invite/claim
 *
 * Auth required. Final invite-claim step after the user has signed in via
 * Privy. Sets a 90-day `payhaven_verified` cookie so future visits skip
 * the invite gate.
 */
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
    return apiError("VALIDATION_FAILED", "Invalid code format");
  }

  let result;
  try {
    result = await validateAndClaimInvite(parsed.data.code, identity.privyUserId);
  } catch (err) {
    log.error("Invite claim threw", {
      privyUserId: identity.privyUserId,
      err: err instanceof Error ? err.message : String(err),
    });
    return apiError("INTERNAL_ERROR", "Failed to validate invite");
  }

  if (!result.ok) {
    if (result.reason === "INVALID") {
      return apiError("VALIDATION_FAILED", "Invite code not recognized");
    }
    return apiError(
      "VALIDATION_FAILED",
      "This invite code has already been claimed by another account.",
    );
  }

  log.info("Invite claimed", {
    privyUserId: identity.privyUserId,
    code: result.code,
    firstUse: result.firstUse,
  });

  const isProd = process.env.NODE_ENV === "production";

  // Two cookies: the httpOnly server-side guard (real auth signal, used by
  // future server middleware), and a non-httpOnly client mirror so the
  // landing page can skip the invite modal on return visits without an API
  // round trip. The client mirror has no security power on its own.
  const cookies = [
    `${COOKIE_NAME}=1; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax; ${isProd ? "Secure" : ""}`,
    `${COOKIE_NAME}_client=1; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; ${isProd ? "Secure" : ""}`,
  ];

  return new Response(
    JSON.stringify({ ok: true, firstUse: result.firstUse }),
    {
      status: 200,
      headers: [
        ["Content-Type", "application/json"],
        ...cookies.map((c) => ["Set-Cookie", c] as [string, string]),
      ],
    },
  );
}