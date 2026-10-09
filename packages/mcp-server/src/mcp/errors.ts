import type { CallToolResult } from '@modelcontextprotocol/server';

/**
 * Why a tool call failed, as a stable kebab-case slug for the client model.
 * Customers never see these: the `content` text is plain language with a next
 * step, and Alexa's own model phrases the reply (PLATFORM-DOCS §2.8, Functional
 * §2: no codes, tool names, JSON or internal ids in customer-facing text).
 */
export type FailureReason =
  | 'not-linked'
  | 'adults-only'
  | 'no-mon'
  | 'mon-not-found'
  | 'not-permitted'
  | 'person-not-found'
  | 'not-detected'
  | 'invalid-input'
  | 'not-confirmed'
  | 'unavailable';

const COPY: Record<FailureReason, { readonly message: string; readonly nextStep: string }> = {
  'not-linked': {
    message: 'Your NYC-MON account is not linked yet.',
    nextStep: 'Link your NYC-MON account in the Alexa app, then ask again.',
  },
  'adults-only': {
    message: 'NYC-MON on Alexa is only for accounts 18 and older.',
    nextStep: 'Keep caring for your Mon in the NYC-MON app.',
  },
  'no-mon': {
    message: "You don't have a hatched Mon yet.",
    nextStep: 'Hatch your egg in the NYC-MON app, then ask again.',
  },
  'mon-not-found': {
    message: "I couldn't find that Mon on your account.",
    nextStep: 'Ask how your Mon is doing to hear which Mons you have.',
  },
  'not-permitted': {
    message: "Only the Mon's Caller can do that.",
    nextStep: 'Ask the Caller to do it, or try talking or playing instead.',
  },
  'person-not-found': {
    message: "I don't know that person yet.",
    nextStep: "Ask who the Mon knows to hear the people in the Mon's circle.",
  },
  'not-detected': {
    message: "That person isn't nearby right now.",
    nextStep: 'Try again once they are in the room.',
  },
  'invalid-input': {
    message: "I couldn't understand that request.",
    nextStep: 'Try asking again in a different way.',
  },
  'not-confirmed': {
    message: "I couldn't confirm that went through.",
    nextStep: 'Ask how your Mon is doing to check before trying again.',
  },
  unavailable: {
    message: "NYC-MON can't reach your Mon right now.",
    nextStep: 'Try again in a minute.',
  },
};

/** A failed call: `isError`, plain text, and `{ error: { reason, message, nextStep } }`. */
export function failure(reason: FailureReason, extra: Record<string, unknown> = {}): CallToolResult {
  const { message, nextStep } = COPY[reason];
  return {
    isError: true,
    content: [{ type: 'text', text: `${message} ${nextStep}` }],
    structuredContent: { error: { reason, message, nextStep, ...extra } },
  };
}

/** A successful call: structured data plus the text mirror Alexa's lifecycle sample uses. */
export function success(data: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
}
