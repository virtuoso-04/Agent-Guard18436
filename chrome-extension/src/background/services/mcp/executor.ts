/**
 * MCPActionExecutor — Agent Guard
 *
 * Bridges the agent's tool-call system with MCP tools, both local (via the
 * MCPRegistry) and remote (via the @modelcontextprotocol/sdk HTTP transport).
 *
 * Architecture:
 *
 *   [Navigator/Planner LLM]
 *        │  tool_call { name, args }
 *        ▼
 *   [MCPActionExecutor.run()]
 *        ├─ local tool?  → MCPRegistry.execute()
 *        └─ remote tool? → SDK Client over StreamableHTTPClientTransport
 *        ▼
 *   sanitized result string → agent context
 *
 * Adding a remote MCP server:
 *   1. Construct an MCPActionExecutor with a serverUrl pointing to the server.
 *   2. Call executor.connect() once before the task starts.
 *   3. The executor discovers the server's tools automatically via listTools().
 *   4. Subsequent run() calls are transparently routed to the remote server.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createLogger } from '@src/background/log';
import { mcpRegistry } from './registry';
import { mcpSettingsStore } from '@agent-guard/storage';
import type { MCPToolResult } from './registry';

const logger = createLogger('MCPActionExecutor');

export interface MCPExecutorOptions {
  /**
   * Optional URL of a remote MCP server (e.g. http://localhost:3000/mcp).
   * When provided, the executor connects via StreamableHTTP and can call
   * any tool the server exposes. Local registry tools are still available.
   */
  serverUrl?: string;
}

export interface MCPToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * MCPActionExecutor wraps both local (registry) and remote (SDK) MCP tools
 * behind a single `run(toolCall)` interface for use inside the agent loop.
 */
export class MCPActionExecutor {
  private sdkClient: Client | null = null;
  private remoteToolNames = new Set<string>();
  private readonly serverUrl: string | undefined;

  constructor(options: MCPExecutorOptions = {}) {
    this.serverUrl = options.serverUrl;
  }

  /**
   * Connect to a remote MCP server and discover its tools.
   * Must be called before `run()` when `serverUrl` is set.
   * Safe to call repeatedly — skips reconnect if already connected.
   */
  async connect(): Promise<void> {
    if (!this.serverUrl || this.sdkClient) return;

    logger.info(`[MCPActionExecutor] Connecting to remote MCP server: ${this.serverUrl}`);

    this.sdkClient = new Client({ name: 'agent-guard', version: '1.0.0' }, { capabilities: {} });

    const transport = new StreamableHTTPClientTransport(new URL(this.serverUrl));
    await this.sdkClient.connect(transport);

    // Discover and cache the server's tool names
    const { tools } = await this.sdkClient.listTools();
    this.remoteToolNames = new Set(tools.map(t => t.name));

    logger.info(`[MCPActionExecutor] Remote tools discovered: ${[...this.remoteToolNames].join(', ')}`);
  }

  /**
   * Execute a tool call. Routing priority:
   *   1. Remote MCP server (if connected and tool is advertised by the server)
   *   2. Local MCPRegistry (Brave Search and any registered local tools)
   */
  async run(toolCall: MCPToolCall): Promise<MCPToolResult> {
    const start = Date.now();

    // Route to remote server if the tool is advertised there
    if (this.sdkClient && this.remoteToolNames.has(toolCall.name)) {
      return this.runRemote(toolCall, start);
    }

    // Fall back to local registry
    return this.runLocal(toolCall, start);
  }

  private async runRemote(toolCall: MCPToolCall, start: number): Promise<MCPToolResult> {
    if (!this.sdkClient) {
      return {
        toolName: toolCall.name,
        success: false,
        error: 'SDK client not connected',
        durationMs: Date.now() - start,
      };
    }

    try {
      logger.info(`[MCPActionExecutor] Remote call: ${toolCall.name}`, toolCall.args);
      const result = await this.sdkClient.callTool({ name: toolCall.name, arguments: toolCall.args });

      const content = result.content as Array<{ type: string; text?: string }>;
      const output = content
        .filter(c => c.type === 'text')
        .map(c => c.text ?? '')
        .join('\n');

      logger.info(`[MCPActionExecutor] Remote call succeeded in ${Date.now() - start}ms`);
      return { toolName: toolCall.name, success: true, output, durationMs: Date.now() - start };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[MCPActionExecutor] Remote call failed: ${message}`);
      return { toolName: toolCall.name, success: false, error: message, durationMs: Date.now() - start };
    }
  }

  private async runLocal(toolCall: MCPToolCall, start: number): Promise<MCPToolResult> {
    const settings = await mcpSettingsStore.getSettings();

    if (!mcpRegistry.hasTool(toolCall.name)) {
      return {
        toolName: toolCall.name,
        success: false,
        error: `Tool "${toolCall.name}" is not registered in Agent Guard's MCP registry.`,
        durationMs: Date.now() - start,
      };
    }

    return mcpRegistry.execute(toolCall.name, toolCall.args, {
      braveSearchApiKey: settings.braveSearchApiKey,
    });
  }

  /**
   * Disconnect from the remote MCP server and release resources.
   */
  async disconnect(): Promise<void> {
    if (this.sdkClient) {
      try {
        await this.sdkClient.close();
      } catch {
        // best-effort
      }
      this.sdkClient = null;
      this.remoteToolNames.clear();
      logger.info('[MCPActionExecutor] Disconnected from remote MCP server.');
    }
  }

  /** Returns names of all tools available (local + remote). */
  availableTools(): string[] {
    const local = mcpRegistry.getToolDescriptors().map(d => d.name);
    const remote = [...this.remoteToolNames];
    return [...new Set([...local, ...remote])];
  }
}
