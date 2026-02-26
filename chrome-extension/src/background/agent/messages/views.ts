import { type BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { Actors } from '../event/types';

// ── Message provenance types (Issue 1.3) ─────────────────────────────────────

/**
 * Trust tier assigned to each message at insertion time.
 * Used by context construction to decide how aggressively to wrap content.
 */
export enum MessageOrigin {
  USER_DIRECT = 'user_direct', // Typed by the human in the side panel
  SYSTEM_INIT = 'system_init', // Set at executor construction
  AGENT_OUTPUT = 'agent_output', // Produced by an LLM agent
  PAGE_CONTENT = 'page_content', // Extracted from a web page DOM
  ACTION_RESULT = 'action_result', // Result of a browser action
}

/**
 * Provenance metadata attached to every managed message.
 * The `hmac` field is an HMAC-SHA256 of `content + JSON(metadata)` using the
 * per-session signing key held by MessageManager.
 */
export interface MessageProvenance {
  origin: MessageOrigin;
  timestamp: number;
  sessionId: string;
  stepNumber: number;
  /** Only set for PAGE_CONTENT messages */
  sourceUrl?: string;
  /** Only set for AGENT_OUTPUT messages */
  agentActor?: Actors;
  /** HMAC-SHA256 hex digest — verified before the message enters LLM context */
  hmac: string;
}

export class MessageMetadata {
  tokens: number;
  message_type: string | null = null;
  /** Provenance record set when the message was added to history */
  provenance: MessageProvenance | null = null;

  constructor(tokens: number, message_type?: string | null, provenance?: MessageProvenance | null) {
    this.tokens = tokens;
    this.message_type = message_type ?? null;
    this.provenance = provenance ?? null;
  }
}

export class ManagedMessage {
  message: BaseMessage;
  metadata: MessageMetadata;

  constructor(message: BaseMessage, metadata: MessageMetadata) {
    this.message = message;
    this.metadata = metadata;
  }
}

export class MessageHistory {
  messages: ManagedMessage[] = [];
  totalTokens = 0;

  addMessage(message: BaseMessage, metadata: MessageMetadata, position?: number): void {
    const managedMessage: ManagedMessage = {
      message,
      metadata,
    };

    if (position === undefined) {
      this.messages.push(managedMessage);
    } else {
      this.messages.splice(position, 0, managedMessage);
    }
    this.totalTokens += metadata.tokens;
  }

  removeMessage(index = -1): void {
    if (this.messages.length > 0) {
      const msg = this.messages.splice(index, 1)[0];
      this.totalTokens -= msg.metadata.tokens;
    }
  }

  /**
   * Removes the last message from the history if it is a human message.
   * This is used to remove the state message from the history.
   */
  removeLastStateMessage(): void {
    if (this.messages.length > 2 && this.messages[this.messages.length - 1].message instanceof HumanMessage) {
      const msg = this.messages.pop();
      if (msg) {
        this.totalTokens -= msg.metadata.tokens;
      }
    }
  }

  /**
   * Get all messages
   */
  getMessages(): BaseMessage[] {
    return this.messages.map(m => m.message);
  }

  /**
   * Get total tokens in history
   */
  getTotalTokens(): number {
    return this.totalTokens;
  }

  /**
   * Remove oldest non-system message
   */
  removeOldestMessage(): void {
    for (let i = 0; i < this.messages.length; i++) {
      if (!(this.messages[i].message instanceof SystemMessage)) {
        const msg = this.messages.splice(i, 1)[0];
        this.totalTokens -= msg.metadata.tokens;
        break;
      }
    }
  }
}
