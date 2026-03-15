/**
 * MCP Settings Storage — Agent Guard
 *
 * Stores configuration for all MCP tool integrations:
 * - Brave Search API key
 * - (Future) GitHub, Notion, Gmail tokens etc.
 */
import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { BaseStorage } from '../base/types';

export interface MCPSettingsConfig {
  /** Brave Search API key — get one free at https://api.search.brave.com/ */
  braveSearchApiKey: string;
  /** Enable/disable the Brave Search MCP tool globally */
  braveSearchEnabled: boolean;
  /** Maximum results per search call (1–10) */
  braveSearchMaxResults: number;
}

export type MCPSettingsStorage = BaseStorage<MCPSettingsConfig> & {
  updateSettings: (settings: Partial<MCPSettingsConfig>) => Promise<void>;
  getSettings: () => Promise<MCPSettingsConfig>;
  resetToDefaults: () => Promise<void>;
};

export const DEFAULT_MCP_SETTINGS: MCPSettingsConfig = {
  braveSearchApiKey: '',
  braveSearchEnabled: false,
  braveSearchMaxResults: 5,
};

const storage = createStorage<MCPSettingsConfig>('mcp-settings-v1', DEFAULT_MCP_SETTINGS, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const mcpSettingsStore: MCPSettingsStorage = {
  ...storage,
  async updateSettings(settings: Partial<MCPSettingsConfig>) {
    const current = (await storage.get()) || DEFAULT_MCP_SETTINGS;
    await storage.set({ ...current, ...settings });
  },
  async getSettings() {
    const settings = await storage.get();
    return { ...DEFAULT_MCP_SETTINGS, ...settings };
  },
  async resetToDefaults() {
    await storage.set(DEFAULT_MCP_SETTINGS);
  },
};
