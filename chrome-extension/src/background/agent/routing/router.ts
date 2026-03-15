/**
 * ModelRouter — Agent Guard multi-model routing
 *
 * Decides which underlying model each agent proxy should use for the next
 * step, based on three real-time signals:
 *
 *   1. Token pressure   — context window filling up → prefer larger-ctx model
 *   2. Failure pressure — consecutive failures → upgrade to most capable model
 *   3. Step phase       — early exploratory steps → prefer faster/cheaper model
 *
 * Candidate pools (one per agent role):
 *
 *   tier='fast'      Used during steps 1–3 (planner only) or when token
 *                    pressure is genuinely low. Typically the navigator model
 *                    since it is configured to be lighter.
 *
 *   tier='balanced'  Default for all steps. The model explicitly configured
 *                    for that agent role.
 *
 *   tier='powerful'  Activated when consecutiveFailures >= FAILURE_THRESHOLD.
 *                    Falls back to balanced if no dedicated powerful model
 *                    was provided. Typically the planner model is used as
 *                    the "powerful" fallback for the navigator.
 *
 * Usage:
 *   const router = new ModelRouter({ navigatorCandidates, plannerCandidates });
 *   // Before each step:
 *   router.route(signals);   // internally calls proxy.setActiveModel(...)
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createLogger } from '@src/background/log';
import { RoutingProxy } from './proxy';

const logger = createLogger('ModelRouter');

// ── Context window registry ───────────────────────────────────────────────────
// Approximate context window sizes (input tokens) for common models.
// Pattern matching: prefix/substring match on model name (lowercase).
// The router uses this to prefer larger-context models under token pressure.

const CONTEXT_WINDOW_PATTERNS: Array<{ pattern: string; tokens: number }> = [
  // Gemini — enormous windows
  { pattern: 'gemini-2.5', tokens: 1_000_000 },
  { pattern: 'gemini-3', tokens: 1_000_000 },
  // Anthropic Claude
  { pattern: 'claude-opus', tokens: 200_000 },
  { pattern: 'claude-sonnet', tokens: 200_000 },
  { pattern: 'claude-haiku', tokens: 200_000 },
  // OpenAI GPT-5 / GPT-4.1
  { pattern: 'gpt-5', tokens: 128_000 },
  { pattern: 'gpt-4.1', tokens: 128_000 },
  { pattern: 'gpt-4o', tokens: 128_000 },
  // Qwen large context
  { pattern: 'qwen2.5-72b', tokens: 128_000 },
  { pattern: 'qwen2.5-32b', tokens: 32_000 },
  // Meta Llama
  { pattern: 'llama-3.3', tokens: 128_000 },
  { pattern: 'llama-3.1-8b', tokens: 8_000 },
  // Mistral
  { pattern: 'mistral-small-3.1', tokens: 128_000 },
  // DeepSeek
  { pattern: 'deepseek-v3', tokens: 64_000 },
  { pattern: 'deepseek-chat', tokens: 64_000 },
  { pattern: 'deepseek-reasoner', tokens: 64_000 },
  // Groq / Cerebras hosted Llama
  { pattern: 'llama-3.3-70b-versatile', tokens: 128_000 },
  { pattern: 'llama-3.3-70b', tokens: 128_000 },
  // Microsoft Phi
  { pattern: 'phi-4', tokens: 16_000 },
  // Google Gemma
  { pattern: 'gemma-3-27b', tokens: 8_000 },
  // Grok
  { pattern: 'grok-4', tokens: 131_072 },
  { pattern: 'grok-3', tokens: 131_072 },
  // Ollama local models
  { pattern: 'qwen3:14b', tokens: 128_000 },
  { pattern: 'mistral-small:24b', tokens: 128_000 },
];

/** Returns the context window size for the given model name. Defaults to 128K. */
export function getContextWindow(modelName: string): number {
  const lower = modelName.toLowerCase();
  for (const { pattern, tokens } of CONTEXT_WINDOW_PATTERNS) {
    if (lower.includes(pattern)) return tokens;
  }
  return 128_000; // safe default
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModelTier = 'fast' | 'balanced' | 'powerful';

export interface ModelCandidate {
  model: BaseChatModel;
  /** Approximate context window in tokens */
  contextWindow: number;
  tier: ModelTier;
  /** Human-readable label for log output */
  label: string;
}

export interface RoutingSignals {
  step: number;
  /** Tokens currently in the message history */
  tokenUsage: number;
  /** Effective max input tokens for this session */
  maxTokens: number;
  /** Consecutive navigator/planner failures */
  consecutiveFailures: number;
}

export interface RouterOptions {
  navigatorCandidates: ModelCandidate[];
  plannerCandidates: ModelCandidate[];
}

// ── Routing thresholds ────────────────────────────────────────────────────────

/** Escalate to 'powerful' model when this many consecutive failures occur. */
const FAILURE_THRESHOLD = 2;
/** Escalate context window preference when token fill exceeds this fraction. */
const TOKEN_PRESSURE_HIGH = 0.8;
/** Use 'fast' tier only when token fill is below this fraction. */
const TOKEN_PRESSURE_LOW = 0.4;
/** Number of "warm-up" steps where the planner uses the fast model. */
const FAST_STEPS = 3;

// ── ModelRouter ───────────────────────────────────────────────────────────────

export class ModelRouter {
  readonly navigatorProxy: RoutingProxy;
  readonly plannerProxy: RoutingProxy;

  private readonly navigatorCandidates: ModelCandidate[];
  private readonly plannerCandidates: ModelCandidate[];

  private lastNavTier: ModelTier | null = null;
  private lastPlanTier: ModelTier | null = null;

  constructor(options: RouterOptions) {
    this.navigatorCandidates = options.navigatorCandidates;
    this.plannerCandidates = options.plannerCandidates;

    const defaultNav = this.pick(this.navigatorCandidates, 'balanced');
    const defaultPlan = this.pick(this.plannerCandidates, 'balanced');

    this.navigatorProxy = new RoutingProxy(defaultNav.model, defaultNav.label);
    this.plannerProxy = new RoutingProxy(defaultPlan.model, defaultPlan.label);
  }

  /**
   * Called at the beginning of each executor step.
   * Updates both proxies so agents use the right model for this step.
   */
  route(signals: RoutingSignals): void {
    const navTier = this.selectTier(signals, 'navigator');
    const planTier = this.selectTier(signals, 'planner');

    const navCandidate = this.pick(this.navigatorCandidates, navTier);
    const planCandidate = this.pick(this.plannerCandidates, planTier);

    if (navTier !== this.lastNavTier) {
      logger.info(
        `[Router] Navigator: ${this.lastNavTier ?? 'init'} → ${navTier} (${navCandidate.label}) ` +
          `| step=${signals.step} tokens=${signals.tokenUsage}/${signals.maxTokens} failures=${signals.consecutiveFailures}`,
      );
      this.navigatorProxy.setActiveModel(navCandidate.model, navCandidate.label);
      this.lastNavTier = navTier;
    }

    if (planTier !== this.lastPlanTier) {
      logger.info(
        `[Router] Planner: ${this.lastPlanTier ?? 'init'} → ${planTier} (${planCandidate.label}) ` +
          `| step=${signals.step} tokens=${signals.tokenUsage}/${signals.maxTokens} failures=${signals.consecutiveFailures}`,
      );
      this.plannerProxy.setActiveModel(planCandidate.model, planCandidate.label);
      this.lastPlanTier = planTier;
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private selectTier(signals: RoutingSignals, role: 'navigator' | 'planner'): ModelTier {
    const tokenPct = signals.maxTokens > 0 ? signals.tokenUsage / signals.maxTokens : 0;
    const candidates = role === 'navigator' ? this.navigatorCandidates : this.plannerCandidates;

    // Rule 1 — Failure pressure: upgrade to most capable model
    if (signals.consecutiveFailures >= FAILURE_THRESHOLD && this.has(candidates, 'powerful')) {
      return 'powerful';
    }

    // Rule 2 — High token pressure: prefer the model with the largest context window
    if (tokenPct > TOKEN_PRESSURE_HIGH) {
      const largestCtx = [...candidates].sort((a, b) => b.contextWindow - a.contextWindow)[0];
      // If the largest-context model is already the active tier, keep it
      const tier = largestCtx.tier;
      if (this.has(candidates, tier)) return tier;
    }

    // Rule 3 — Early fast phase (planner only): cheap model for simple planning
    if (role === 'planner' && signals.step <= FAST_STEPS && tokenPct < TOKEN_PRESSURE_LOW) {
      if (this.has(candidates, 'fast')) return 'fast';
    }

    // Default: balanced (primary configured model)
    return 'balanced';
  }

  /** Returns the best available candidate for the given tier. Falls back to balanced. */
  private pick(candidates: ModelCandidate[], tier: ModelTier): ModelCandidate {
    return candidates.find(c => c.tier === tier) ?? candidates.find(c => c.tier === 'balanced') ?? candidates[0];
  }

  private has(candidates: ModelCandidate[], tier: ModelTier): boolean {
    return candidates.some(c => c.tier === tier);
  }
}

/**
 * Build the navigator and planner candidate arrays from the two configured
 * chat models. Uses the planner as the 'powerful' fallback for the navigator
 * (on failures) and the navigator as the 'fast' option for the planner
 * (on early low-pressure steps). When both models are the same instance,
 * routing degrades gracefully to a no-op.
 */
export function buildCandidates(
  navigatorLLM: BaseChatModel,
  plannerLLM: BaseChatModel,
  navigatorModelName: string,
  plannerModelName: string,
): { navigatorCandidates: ModelCandidate[]; plannerCandidates: ModelCandidate[] } {
  const navCtx = getContextWindow(navigatorModelName);
  const planCtx = getContextWindow(plannerModelName);

  const navigatorCandidates: ModelCandidate[] = [
    { model: navigatorLLM, contextWindow: navCtx, tier: 'balanced', label: navigatorModelName },
  ];

  const plannerCandidates: ModelCandidate[] = [
    { model: plannerLLM, contextWindow: planCtx, tier: 'balanced', label: plannerModelName },
  ];

  // Cross-pollinate only when models differ — avoids pointless tier switches
  if (navigatorLLM !== plannerLLM) {
    // Planner is typically more capable → use as 'powerful' fallback for navigator
    navigatorCandidates.push({
      model: plannerLLM,
      contextWindow: planCtx,
      tier: 'powerful',
      label: `${plannerModelName} [fallback]`,
    });

    // Navigator is typically cheaper/faster → use as 'fast' option for planner early steps
    plannerCandidates.push({
      model: navigatorLLM,
      contextWindow: navCtx,
      tier: 'fast',
      label: `${navigatorModelName} [fast]`,
    });

    // Also give navigator access to larger context if the planner has one
    if (planCtx > navCtx) {
      logger.info(
        `[Router] Planner has larger context (${planCtx} vs ${navCtx}) — will be used for navigator under token pressure`,
      );
    }
  }

  return { navigatorCandidates, plannerCandidates };
}
