/**
 * WhatsApp deep links for "Request an Invite" CTAs. Centralized here so
 * there's one source of truth for the founder's number + message text.
 */

const FOUNDER_PHONE_E164 = "+2349071414531";
const REQUEST_INVITE_MESSAGE =
  "Hi, I'd like to request an invite code for Payhaven.";

/** Build the wa.me URL for the "Request an Invite" CTA. */
export function buildRequestInviteUrl(): string {
  const phoneNoPlus = FOUNDER_PHONE_E164.replace(/^\+/, "");
  return (
    "https://wa.me/" + phoneNoPlus + "?text=" + encodeURIComponent(REQUEST_INVITE_MESSAGE)
  );
}