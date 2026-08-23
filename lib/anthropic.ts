import Anthropic from "@anthropic-ai/sdk";

/**
 * Single shared client. The SDK reads ANTHROPIC_API_KEY from the environment,
 * so nothing here should ever reach the browser — every import site must be a
 * server component, route handler, or server action.
 */
export const anthropic = new Anthropic();

/** Default generation model for the demos. */
export const MODEL = "claude-opus-5";

/** Cheap model for high-volume, low-stakes calls (title generation, routing). */
export const FAST_MODEL = "claude-haiku-4-5";

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
