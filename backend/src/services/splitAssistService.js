import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic, CLAUDE_MODEL } from '../utils/anthropic.js';
import { logger } from '../utils/logger.js';
import { normalizeTitle, MAX_DUMP_ITEMS } from './stackService.js';

/**
 * "Too big" assist.
 *
 * This is the one moment in the stack where an LLM genuinely earns its cost.
 * A card that keeps getting pushed is usually several tasks wearing a trench
 * coat, and the reason the user froze in the first place is that they can't
 * see the first step. Naming that step is exactly what a model is good at.
 *
 * It only ever *suggests*. The pieces come back to the client and land in an
 * editable box -- nothing is written to the stack until the user confirms.
 * An app that silently restructures your list is an app you stop trusting,
 * and trust in the surface is the whole product (PROBLEM.md).
 */

/** Suggestions are a starting point, not a plan. Keep it short. */
export const MIN_PIECES = 2;
export const MAX_PIECES = 5;

const PiecesSchema = z.object({
  pieces: z
    .array(z.string())
    .describe(
      `Between ${MIN_PIECES} and ${MAX_PIECES} concrete steps, in the order they should be done.`
    ),
});

const SYSTEM_PROMPT = `You break an overwhelming task into its smallest concrete steps.

The person using this app is frozen. They have a lot to do, it lives in their
head, and the size of it stops them starting anything. They have flagged one
task as "too big". Your only job is to make the first step small enough that
starting is easy.

Rules:
- Give between ${MIN_PIECES} and ${MAX_PIECES} steps. Fewer is better. Never pad to hit a number.
- The FIRST step must be something they could physically start in the next two
  minutes, without preparation, information they don't have, or anyone else.
- Every step is one concrete physical action: "find the number on the back of
  the card", "open the form", "write down the three dates".
- Never use vague planning verbs as a step: no "plan", "organize", "prepare",
  "think about", "research", "figure out", "get started on". Those are the
  fog the person is already stuck in.
- Steps must be things a person does, not outcomes they achieve.
- Write in plain second-person-implied language, lowercase, no numbering, no
  punctuation at the end. Match how someone types a quick note to themselves.
- Do not invent specifics you weren't given. If the task is "call the bank",
  you don't know which bank or why -- keep the steps general enough to be true.
- If the task is already small and atomic, return the fewest steps that
  honestly break it up rather than inventing filler.`;

/**
 * Ask Claude for the smallest first steps of a task.
 *
 * Returns an array of clean titles, ready to show the user for editing.
 */
export const suggestPieces = async (title) => {
  const client = getAnthropic();

  const response = await client.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    // Effort is tuned per route, not globally. This is a short, tightly
    // specified extraction, and it can be hit many times in one sitting --
    // "low" keeps it fast and affordable without hurting a task this small.
    // Raise it here if suggestions start coming back shallow.
    output_config: {
      effort: 'low',
      format: zodOutputFormat(PiecesSchema),
    },
    messages: [
      {
        role: 'user',
        content: `Break this into its smallest concrete steps:\n\n${title}`,
      },
    ],
  });

  // parsed_output is null when the model's output failed schema validation.
  const parsed = response.parsed_output;
  if (!parsed?.pieces) {
    logger.warn('Split assist returned no usable pieces', {
      module: 'splitAssistService',
      stopReason: response.stop_reason,
    });
    return [];
  }

  // Run the suggestions through the same cleaning as a hand-typed dump, so a
  // model that numbers its list or adds bullets costs the user nothing.
  const pieces = parsed.pieces
    .map((piece) => normalizeTitle(piece))
    .filter(Boolean)
    .slice(0, Math.min(MAX_PIECES, MAX_DUMP_ITEMS));

  logger.info('Split assist suggested pieces', {
    module: 'splitAssistService',
    count: pieces.length,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
  });

  return pieces;
};
