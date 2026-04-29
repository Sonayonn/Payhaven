/**
 * Redact a recipient identifier for display.
 *
 * Email: shows first 3 chars of local part, masks the rest, keeps domain.
 *    olu*****@gmail.com
 *
 * Phone: keeps country code prefix and last 4 digits, masks the middle.
 *   +2348123456789 → +234*****6789
 *
 * Anything else returns as-is. The contract: the redacted form should be
 * recognizable to the actual recipient (so they can confirm "yes that's
 * me") without leaking enough to identify them to an observer.
 */
export function redactIdentifier(identifier: string): string {
  if (identifier.includes("@")) {
    const [local, domain] = identifier.split("@");
    const visible = local.slice(0, 3);
    return `${visible}${"*".repeat(Math.max(1, local.length - 3))}@${domain}`;
  }
  if (identifier.startsWith("+")) {
    const last4 = identifier.slice(-4);
    return `${identifier.slice(0, 4)}${"*".repeat(Math.max(0, identifier.length - 8))}${last4}`;
  }
  return identifier;
}