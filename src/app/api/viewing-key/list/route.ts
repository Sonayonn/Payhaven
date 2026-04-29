import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { listActiveGrants } from "@/lib/viewing-keys/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return apiError("UNAUTHORIZED", "Missing Authorization header");

  let identity;
  try {
    identity = await verifyPrivyTokenAndGetIdentifiers(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  try {
    const grants = await listActiveGrants(identity.privyUserId);
    return Response.json({
      ok: true,
      grants: grants.map((g) => ({
        id: g.id,
        mintAddress: g.mintAddress,
        startYear: g.startYear,
        startMonth: g.startMonth,
        endYear: g.endYear,
        endMonth: g.endMonth,
        label: g.label,
        generatedAt: g.generatedAt,
      })),
    });
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to list grants", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }
}