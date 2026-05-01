"use client";

const COOKIE_NAME = "payhaven_verified";

/**
 * Read the payhaven_verified flag client-side. Returns false on the server
 * (no document), the landing page handles the SSR case by always rendering
 * the invite modal initially, then hiding it after hydration if the cookie
 * is set.
 */
export function isPayhavenVerified(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie.match(new RegExp("(^| )" + COOKIE_NAME + "_client=1"));
  return Boolean(match);
}