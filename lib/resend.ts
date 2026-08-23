import { Resend } from "resend";

/**
 * Single shared client, mirroring lib/anthropic.ts. Server-only: every import
 * site must be a route handler or server action.
 */
export const resend = new Resend(process.env.RESEND_API_KEY);

export function hasResendKey(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Address the contact form delivers to. Not baked into the page or bundle. */
export const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL ?? "";

/**
 * Sender address for the notification email. Resend's shared test domain
 * works without any DNS setup; swap in a verified domain address once one is
 * configured.
 */
export const CONTACT_FROM_EMAIL =
  process.env.CONTACT_FROM_EMAIL ?? "onboarding@resend.dev";
