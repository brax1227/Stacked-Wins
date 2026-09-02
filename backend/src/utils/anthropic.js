import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

/**
 * Lazily-constructed Anthropic client.
 *
 * Built on first use rather than at import time on purpose: the SDK throws when
 * no key is present, and a missing key for an optional AI feature must not stop
 * the whole server from booting. Every AI feature here is additive -- the stack
 * works fine without one.
 */

/** The model every AI feature in this app uses. */
export const CLAUDE_MODEL = 'claude-opus-5';

let client = null;

/**
 * Whether an API key is configured. Call this before offering an AI feature so
 * the UI can hide it rather than fail on click.
 */
export const isAiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

/**
 * Get the shared client, or throw a clear error the caller can turn into a 503.
 */
export const getAnthropic = () => {
  if (!isAiConfigured()) {
    const error = new Error('AI is not configured (ANTHROPIC_API_KEY is not set)');
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }

  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    logger.info('Anthropic client initialised', {
      module: 'anthropic',
      model: CLAUDE_MODEL,
    });
  }

  return client;
};

/**
 * Reset the memoised client. Tests only.
 */
export const resetAnthropicClient = () => {
  client = null;
};
