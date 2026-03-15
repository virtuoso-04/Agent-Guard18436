/**
 * Agent Guard MCP Registry
 *
 * Central dispatcher for Model Context Protocol (MCP) tool calls.
 * The agent's planner/navigator can call registered tools by name,
 * and this registry routes the call to the correct implementation
 * while enforcing Guard security policies on each invocation.
 *
 * Architecture:
 *   [Planner] → calls tool → [MCPRegistry] → [Guard security check]
 *                                          → [Tool implementation]
 *                                          → [Result sanitization]
 *                                          → [Audit log entry]
 *
 * Adding new tools: implement the tool, then register it here.
 */

import { createLogger } from '@src/background/log';
import { braveWebSearch, formatSearchResultsForLLM, BRAVE_SEARCH_MCP_TOOL } from './braveSearch';
import type { BraveSearchOptions } from './braveSearch';

const logger = createLogger('MCPRegistry');

// ─── Tool Registry Types ────────────────────────────────────────────────────

export interface MCPToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[] | readonly string[];
  };
}

export interface MCPToolResult {
  toolName: string;
  success: boolean;
  output?: string;
  error?: string;
  /** Duration of the tool call in ms */
  durationMs: number;
  /** Whether Guard modified the output */
  wasModified?: boolean;
}

type ToolHandler = (args: Record<string, unknown>, config: MCPConfig) => Promise<MCPToolResult>;

// ─── Config ─────────────────────────────────────────────────────────────────

export interface MCPConfig {
  braveSearchApiKey?: string;
}

// ─── Tool handlers ──────────────────────────────────────────────────────────

const braveSearchHandler: ToolHandler = async (args, config) => {
  const start = Date.now();
  try {
    if (!config.braveSearchApiKey) {
      return {
        toolName: 'brave_web_search',
        success: false,
        error: 'Brave Search API key not configured. Add it in Agent Guard Settings → MCP Tools.',
        durationMs: Date.now() - start,
      };
    }

    const query = args.query as string;
    const options: BraveSearchOptions = {
      count: (args.count as number) || 5,
      freshness: args.freshness as BraveSearchOptions['freshness'],
    };

    const result = await braveWebSearch(config.braveSearchApiKey, query, options);
    const formatted = formatSearchResultsForLLM(result);

    return {
      toolName: 'brave_web_search',
      success: true,
      output: formatted,
      durationMs: Date.now() - start,
      wasModified: result.wasModified,
    };
  } catch (error: any) {
    logger.error('[MCPRegistry] brave_web_search failed:', error);
    return {
      toolName: 'brave_web_search',
      success: false,
      error: error?.message || 'Unknown error during Brave Search',
      durationMs: Date.now() - start,
    };
  }
};

// ─── Registry ────────────────────────────────────────────────────────────────

class MCPRegistry {
  private tools = new Map<string, { descriptor: MCPToolDescriptor; handler: ToolHandler }>();

  constructor() {
    // Register all available MCP tools
    this.register(BRAVE_SEARCH_MCP_TOOL, braveSearchHandler);
  }

  /**
   * Register a new MCP tool with its descriptor and handler.
   */
  register(descriptor: MCPToolDescriptor, handler: ToolHandler): void {
    this.tools.set(descriptor.name, { descriptor, handler });
    logger.info(`[MCPRegistry] Registered tool: ${descriptor.name}`);
  }

  /**
   * Get descriptors for all registered tools.
   * Used to inject tool definitions into the LLM's system prompt.
   */
  getToolDescriptors(): MCPToolDescriptor[] {
    return Array.from(this.tools.values()).map(t => t.descriptor);
  }

  /**
   * Get the tools JSON schema for LangChain / OpenAI tool calling.
   */
  getToolsForLLM(): Array<{ type: 'function'; function: MCPToolDescriptor }> {
    return this.getToolDescriptors().map(d => ({ type: 'function' as const, function: d }));
  }

  /**
   * Execute a named tool with given arguments.
   * All tool calls are logged to the Guard audit log.
   */
  async execute(toolName: string, args: Record<string, unknown>, config: MCPConfig): Promise<MCPToolResult> {
    const start = Date.now();
    const tool = this.tools.get(toolName);

    if (!tool) {
      logger.warning(`[MCPRegistry] Unknown tool requested: ${toolName}`);
      return {
        toolName,
        success: false,
        error: `Tool "${toolName}" is not registered in Agent Guard's MCP registry.`,
        durationMs: Date.now() - start,
      };
    }

    logger.info(`[MCPRegistry] Executing tool: ${toolName}`, args);

    try {
      const result = await tool.handler(args, config);
      logger.info(`[MCPRegistry] Tool "${toolName}" completed in ${result.durationMs}ms. Success: ${result.success}`);
      return result;
    } catch (error: any) {
      logger.error(`[MCPRegistry] Tool "${toolName}" threw unexpectedly:`, error);
      return {
        toolName,
        success: false,
        error: error?.message || 'Tool execution failed unexpectedly',
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Returns true if the given tool name is registered.
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }
}

// Singleton instance
export const mcpRegistry = new MCPRegistry();
