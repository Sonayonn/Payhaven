/**
 * Standardized API error responses.
 *
 * All API routes use `apiError(...)` to return a consistent error shape:
 *   { error: { code: string, message: string } }
 *
 * The `code` is stable and machine-readable; the `message` is human-facing.
 * Never include stack traces, env vars, or secrets in error responses.
 */

import { NextResponse } from "next/server";
import { log } from "@/lib/log";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

const STATUS_FOR_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  opts?: { logFields?: Record<string, unknown> },
): NextResponse {
  if (code === "INTERNAL_ERROR" || code === "UPSTREAM_ERROR") {
    log.error(`API error: ${code}`, { message, ...opts?.logFields });
  } else {
    log.warn(`API error: ${code}`, { message, ...opts?.logFields });
  }

  return NextResponse.json(
    { error: { code, message } },
    { status: STATUS_FOR_CODE[code] },
  );
}