import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/errors";
import { checkCodeExists } from "@/lib/invite-codes/server";

const requestSchema = z.object({
  code: z.string().min(3).max(64),
});

/**
 * POST /api/invite/precheck
 *
 * Pre-Privy validation. No auth needed, this is the public-facing gate.
 * Returns { exists: true/false }. Doesn't claim the code; final claim
 * happens AFTER the user successfully authenticates.
 */
export async function POST(req: NextRequest) {
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

  try {
    const exists = await checkCodeExists(parsed.data.code);
    return Response.json({ ok: true, exists });
  } catch (err) {
    return apiError("INTERNAL_ERROR", "Lookup failed", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }
}