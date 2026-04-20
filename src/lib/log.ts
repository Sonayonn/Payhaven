/**
 * Structured logging.
 *
 * - Development: pretty-printed, human-readable, colored
 * - Production: single-line JSON per log entry, machine-parseable
 *
 * Never log secrets. Fields named `secret*`, `privateKey*`, `password*`,
 * or `*token` (case-insensitive) are automatically redacted.
 */

import { env } from "./env";

type LogLevel = "debug" | "info" | "warn" | "error";

const SECRET_FIELD_RE = /(secret|privatekey|password|token)/i;

function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_FIELD_RE.test(k) ? "[REDACTED]" : redact(v);
  }
  return out;
}

function emit(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
  const safe = fields ? (redact(fields) as Record<string, unknown>) : undefined;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(safe ?? {}),
  };

  if (env.NODE_ENV === "production") {
    // JSON per line — standard for log aggregators (Datadog, Better Stack etc.)
    console[level === "debug" ? "log" : level](JSON.stringify(entry));
    return;
  }

  // Dev: readable format
  const color =
    level === "error" ? "\x1b[31m" :
    level === "warn"  ? "\x1b[33m" :
    level === "info"  ? "\x1b[36m" :
                        "\x1b[90m";
  const reset = "\x1b[0m";
  const prefix = `${color}[${level.toUpperCase()}]${reset}`;
  if (safe && Object.keys(safe).length > 0) {
    console[level === "debug" ? "log" : level](prefix, msg, safe);
  } else {
    console[level === "debug" ? "log" : level](prefix, msg);
  }
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  info:  (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn:  (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};