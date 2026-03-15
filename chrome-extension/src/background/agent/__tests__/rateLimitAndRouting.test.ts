/**
 * Unit tests for:
 *  - isRateLimitError / extractRetryAfter edge cases
 *  - RoutingProxy.modelName with instance-property shadowing
 *  - Rate-limit errors propagate as fatal (never increment consecutiveFailures)
 */

import { describe, it, expect, vi } from 'vitest';
import { isRateLimitError, extractRetryAfter, ChatModelRateLimitError, isAuthenticationError } from '../agents/errors';

// ── isRateLimitError ──────────────────────────────────────────────────────────

describe('isRateLimitError', () => {
  it('returns false for non-Error values', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError('429')).toBe(false);
    expect(isRateLimitError(429)).toBe(false);
  });

  it('detects bare [429 ] format (Google AI SDK)', () => {
    const err = new Error('Error fetching from https://api.example.com: [429 ] You exceeded your quota');
    expect(isRateLimitError(err)).toBe(true);
  });

  it('detects wrapped message containing [429 ]', () => {
    const original = new Error('[GoogleGenerativeAI Error]: Error fetching from URL: [429 ] Quota exceeded');
    const wrapped = new Error(`Failed to invoke gemini-2.5-flash with structured output: \n${original.message}`);
    expect(isRateLimitError(wrapped)).toBe(true);
  });

  it('detects "quota exceeded" (case-insensitive)', () => {
    expect(isRateLimitError(new Error('Quota Exceeded for this model'))).toBe(true);
    expect(isRateLimitError(new Error('quota exceeded'))).toBe(true);
  });

  it('detects "rate limit" phrasing', () => {
    expect(isRateLimitError(new Error('Rate limit reached for the API'))).toBe(true);
  });

  it('detects "too many requests"', () => {
    expect(isRateLimitError(new Error('Too many requests, slow down'))).toBe(true);
  });

  it('detects resource_exhausted (Gemini gRPC path)', () => {
    expect(isRateLimitError(new Error('RESOURCE_EXHAUSTED: quota limit hit'))).toBe(true);
  });

  it('does NOT flag unrelated errors', () => {
    expect(isRateLimitError(new Error('Network timeout'))).toBe(false);
    expect(isRateLimitError(new Error('401 Unauthorized'))).toBe(false);
    expect(isRateLimitError(new Error('500 Internal Server Error'))).toBe(false);
  });

  it('does NOT flag auth errors', () => {
    const authErr = new Error('AuthenticationError: invalid API key');
    expect(isRateLimitError(authErr)).toBe(false);
    expect(isAuthenticationError(authErr)).toBe(true);
  });
});

// ── extractRetryAfter ─────────────────────────────────────────────────────────

describe('extractRetryAfter', () => {
  it('returns undefined for non-Error', () => {
    expect(extractRetryAfter(null)).toBeUndefined();
    expect(extractRetryAfter('retry in 10s')).toBeUndefined();
  });

  it('parses integer seconds', () => {
    const err = new Error('Please retry in 59s. [...]');
    expect(extractRetryAfter(err)).toBe(59);
  });

  it('parses fractional seconds and rounds up', () => {
    const err = new Error('Please retry in 12.947789554s. [...]');
    expect(extractRetryAfter(err)).toBe(13);
  });

  it('returns undefined when no retry hint present', () => {
    const err = new Error('[429 ] Quota exceeded with no retry info');
    expect(extractRetryAfter(err)).toBeUndefined();
  });
});

// ── ChatModelRateLimitError ───────────────────────────────────────────────────

describe('ChatModelRateLimitError', () => {
  it('is an instance of Error', () => {
    const err = new ChatModelRateLimitError('quota exceeded', undefined, 30);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ChatModelRateLimitError);
  });

  it('stores retryAfterSeconds', () => {
    const err = new ChatModelRateLimitError('msg', undefined, 45);
    expect(err.retryAfterSeconds).toBe(45);
    expect(err.name).toBe('ChatModelRateLimitError');
  });

  it('toString includes cause', () => {
    const cause = new Error('original');
    const err = new ChatModelRateLimitError('rate limit', cause);
    expect(err.toString()).toContain('ChatModelRateLimitError');
    expect(err.toString()).toContain('original');
  });
});

// ── RoutingProxy.modelName instance-property shadowing ────────────────────────

describe('RoutingProxy modelName', () => {
  it('reads modelName from active model (Gemini-style: model property)', async () => {
    const { RoutingProxy } = await import('../routing/proxy');
    const { BaseChatModel } = await import('@langchain/core/language_models/chat_models');

    // Simulate ChatGoogleGenerativeAI which stores the name in `model`
    const fakeLLM = Object.create(BaseChatModel.prototype) as InstanceType<typeof BaseChatModel> & {
      model: string;
    };
    fakeLLM.model = 'gemini-2.5-flash';
    // Ensure modelName is not set (like BaseChatModel default — undefined)
    Object.defineProperty(fakeLLM, 'modelName', { value: undefined, writable: true, configurable: true });

    const proxy = new RoutingProxy(fakeLLM, 'balanced');
    // The proxy should read `model` and return 'gemini-2.5-flash'
    expect((proxy as unknown as { modelName: string }).modelName).toBe('gemini-2.5-flash');
  });

  it('reads modelName from active model (OpenAI-style: modelName property)', async () => {
    const { RoutingProxy } = await import('../routing/proxy');
    const { BaseChatModel } = await import('@langchain/core/language_models/chat_models');

    const fakeLLM = Object.create(BaseChatModel.prototype) as InstanceType<typeof BaseChatModel> & {
      modelName: string;
    };
    fakeLLM.modelName = 'gpt-4o';

    const proxy = new RoutingProxy(fakeLLM, 'balanced');
    expect((proxy as unknown as { modelName: string }).modelName).toBe('gpt-4o');
  });

  it('falls back to label when active model has no name property', async () => {
    const { RoutingProxy } = await import('../routing/proxy');
    const { BaseChatModel } = await import('@langchain/core/language_models/chat_models');

    const fakeLLM = Object.create(BaseChatModel.prototype) as InstanceType<typeof BaseChatModel>;
    // Explicitly unset all name properties
    Object.defineProperty(fakeLLM, 'modelName', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(fakeLLM, 'model', { value: undefined, writable: true, configurable: true });

    const proxy = new RoutingProxy(fakeLLM, 'my-label');
    expect((proxy as unknown as { modelName: string }).modelName).toBe('my-label');
  });

  it('updates modelName after setActiveModel swap', async () => {
    const { RoutingProxy } = await import('../routing/proxy');
    const { BaseChatModel } = await import('@langchain/core/language_models/chat_models');

    const gemini = Object.create(BaseChatModel.prototype) as InstanceType<typeof BaseChatModel> & { model: string };
    gemini.model = 'gemini-2.5-flash';
    Object.defineProperty(gemini, 'modelName', { value: undefined, writable: true, configurable: true });

    const openai = Object.create(BaseChatModel.prototype) as InstanceType<typeof BaseChatModel> & {
      modelName: string;
    };
    openai.modelName = 'gpt-4o';

    const proxy = new RoutingProxy(gemini, 'balanced');
    expect((proxy as unknown as { modelName: string }).modelName).toBe('gemini-2.5-flash');

    proxy.setActiveModel(openai, 'powerful');
    expect((proxy as unknown as { modelName: string }).modelName).toBe('gpt-4o');
  });
});

// ── isRateLimitError vs real Google AI error shape ────────────────────────────

describe('isRateLimitError with real-world Google AI 429 payload', () => {
  // Reconstruct exactly what the console log shows
  const REAL_GOOGLE_429_MESSAGE = `[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [429 ] You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash\nPlease retry in 59.272894659s.`;

  it('detects the raw Google AI 429 error', () => {
    const err = new Error(REAL_GOOGLE_429_MESSAGE);
    expect(isRateLimitError(err)).toBe(true);
  });

  it('detects the wrapped version from BaseAgent.invoke()', () => {
    const wrappedMsg = `Failed to invoke gemini-2.5-flash with structured output: \n${REAL_GOOGLE_429_MESSAGE}`;
    expect(isRateLimitError(new Error(wrappedMsg))).toBe(true);
  });

  it('extracts the retry-after seconds from real payload', () => {
    const err = new Error(REAL_GOOGLE_429_MESSAGE);
    expect(extractRetryAfter(err)).toBe(60); // ceil(59.272...)
  });
});
