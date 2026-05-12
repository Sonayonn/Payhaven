/**
 * Standardized API error responses.
 * Other error codes (BAD_REQUEST, VALIDATION_FAILED, UNAUTHORIZED, NOT_FOUND)
 * are user-facing by design — their messages tell the user what to do
 * (e.g., "Not enough SOL for fees"), so we don't sanitize them.
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

const SAFE_PRODUCTION_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  INTERNAL_ERROR:
    "Something went wrong on our end. Please try again — if it keeps happening, give us a shout.",
  UPSTREAM_ERROR:
    "Not enough sol for gas, topup your wallet and try again. If you just topped up, please allow a minute for the network to reflect the new balance.",
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  opts?: { logFields?: Record<string, unknown> },
): NextResponse {
  // Always log the FULL message server-side for debugging.
  if (code === "INTERNAL_ERROR" || code === "UPSTREAM_ERROR") {
    log.error(`API error: ${code}`, { message, ...opts?.logFields });
  } else {
    log.warn(`API error: ${code}`, { message, ...opts?.logFields });
  }

  // In production, sanitize messages for codes that typically wrap
  // SDK/RPC/secret-adjacent details. User-facing codes pass through.
  const isProduction = process.env.NODE_ENV === "production";
  const userFacingMessage =
    isProduction && SAFE_PRODUCTION_MESSAGES[code]
      ? SAFE_PRODUCTION_MESSAGES[code]!
      : message;

  return NextResponse.json(
    { error: { code, message: userFacingMessage } },
    { status: STATUS_FOR_CODE[code] },
  );
}