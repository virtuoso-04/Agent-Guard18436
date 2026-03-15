/**
 * RoutingProxy — Agent Guard multi-model routing
 *
 * A transparent BaseChatModel subclass that holds a pointer to the "active"
 * model. The ModelRouter swaps this pointer at the start of each step; agents
 * (Navigator, Planner) hold the proxy for the entire task and never know a
 * swap happened.
 *
 * Two critical delegation points:
 *  - _generate()          — used by invoke() / generate() internally
 *  - withStructuredOutput() — used by agents for JSON schema tool-calling
 *
 * Both delegate straight to the active model so native tool-calling
 * (e.g. Anthropic tool_use, OpenAI function_call) is preserved without
 * wrapping or re-serialisation.
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import type { BaseMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import type { Runnable } from '@langchain/core/runnables';

export class RoutingProxy extends BaseChatModel {
  private active: BaseChatModel;
  private activeLabel: string;

  constructor(initialModel: BaseChatModel, label = 'primary') {
    super({});
    this.active = initialModel;
    this.activeLabel = label;
    // BaseChatModel sets `modelName` as an instance property in its constructor,
    // shadowing any prototype getter. Redefine it on this instance so BaseAgent
    // always reads the active model's real name even after model swaps.
    Object.defineProperty(this, 'modelName', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get: (): string => {
        const m = this.active as unknown as Record<string, unknown>;
        if (m['modelName']) return m['modelName'] as string;
        if (m['model_name']) return m['model_name'] as string;
        if (m['model']) return m['model'] as string;
        return this.activeLabel;
      },
      enumerable: true,
      configurable: true,
    });
  }

  _llmType(): string {
    return `routing-proxy[${this.activeLabel}]`;
  }

  /** Called by ModelRouter at the start of each step. */
  setActiveModel(model: BaseChatModel, label: string): void {
    this.active = model;
    this.activeLabel = label;
  }

  getActiveModel(): BaseChatModel {
    return this.active;
  }

  getActiveLabel(): string {
    return this.activeLabel;
  }

  /**
   * Delegate _generate to the active model's public invoke() API so that the
   * active model's full LangChain middleware stack runs (retries, callbacks,
   * etc.). The ChatResult wrapper preserves tool_calls carried on the message.
   */
  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.active.invoke(messages, options as any);
    return {
      generations: [
        {
          message: response,
          text: typeof response.content === 'string' ? response.content : '',
        },
      ],
    };
  }

  /**
   * Delegate withStructuredOutput to the active model so each model can use
   * its own native tool-calling mechanism (function_call, tool_use, JSON mode).
   * Returns whatever Runnable the active model produces — callers don't need
   * to know the underlying mechanism changed.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override withStructuredOutput<RunOutput extends Record<string, any>>(
    schema: any,
    config?: any,
  ): Runnable<BaseLanguageModelInput, RunOutput> {
    return this.active.withStructuredOutput<RunOutput>(schema, config);
  }
}
