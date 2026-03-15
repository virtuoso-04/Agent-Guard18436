import { useEffect, useState } from 'react';
import { mcpSettingsStore } from '@agent-guard/storage';
import type { MCPSettingsConfig } from '@agent-guard/storage';
import { FiEye, FiEyeOff, FiExternalLink, FiSave, FiCheckCircle } from 'react-icons/fi';

interface MCPSettingsProps {
  isDarkMode?: boolean;
}

const focusRingClasses =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guard-primary focus-visible:shadow-lg focus-visible:shadow-guard-primary/30';

export const MCPSettings = ({ isDarkMode = false }: MCPSettingsProps) => {
  const [config, setConfig] = useState<MCPSettingsConfig>({
    braveSearchApiKey: '',
    braveSearchEnabled: false,
    braveSearchMaxResults: 5,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    mcpSettingsStore.getSettings().then(setConfig);
  }, []);

  const handleSave = async () => {
    setSaveState('saving');
    await mcpSettingsStore.updateSettings(config);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2000);
  };

  const inputClass = `w-full rounded-2xl border py-3 px-4 glass outline-none focus:ring-2 focus:ring-guard-primary transition-all text-sm ${
    isDarkMode ? 'border-apple-dark-border' : 'border-apple-border'
  }`;

  return (
    <div className="animate-in fade-in space-y-8 duration-700">
      {/* Brave Search */}
      <div className="settings-card space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-base">Brave Search</h3>
            <p className="text-xs opacity-50 mt-1">
              Gives agents real-time web search without navigating browser tabs. Results are sanitized by Guard before
              reaching the LLM.
            </p>
          </div>
          {/* Enable toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={config.braveSearchEnabled}
            onClick={() => setConfig(c => ({ ...c, braveSearchEnabled: !c.braveSearchEnabled }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${focusRingClasses} ${
              config.braveSearchEnabled ? 'bg-guard-primary' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
            }`}>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                config.braveSearchEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest opacity-50">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={config.braveSearchApiKey}
              onChange={e => setConfig(c => ({ ...c, braveSearchApiKey: e.target.value }))}
              placeholder="BSA..."
              className={`${inputClass} pr-12`}
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 transition-opacity"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}>
              {showApiKey ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
          <p className="text-[10px] opacity-40 flex items-center gap-1">
            Get a free key (2,000 searches/month) at{' '}
            <a
              href="https://api.search.brave.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-guard-primary underline hover:opacity-80 inline-flex items-center gap-0.5">
              api.search.brave.com <FiExternalLink size={10} />
            </a>
          </p>
        </div>

        {/* Max Results */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest opacity-50">Max Results per Search</label>
            <span className="text-sm font-bold tabular-nums">{config.braveSearchMaxResults}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={config.braveSearchMaxResults}
            onChange={e => setConfig(c => ({ ...c, braveSearchMaxResults: Number(e.target.value) }))}
            className="w-full accent-guard-primary"
          />
          <div className="flex justify-between text-[10px] opacity-30 font-medium">
            <span>1 (faster)</span>
            <span>10 (more context)</span>
          </div>
        </div>
      </div>

      {/* Coming soon */}
      <div className="settings-card opacity-50 space-y-3">
        <h3 className="font-bold text-base">More MCP Tools</h3>
        <p className="text-xs opacity-60">GitHub, Notion, Gmail, and custom MCP servers — coming soon.</p>
        <div className="flex flex-wrap gap-2">
          {['GitHub', 'Notion', 'Gmail', 'Slack', 'Custom Server'].map(name => (
            <span
              key={name}
              className="px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest opacity-50">
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${focusRingClasses} ${
            saveState === 'saved'
              ? 'bg-safe-green/20 text-safe-green'
              : 'bg-guard-primary text-white hover:bg-guard-primary/90'
          }`}>
          {saveState === 'saved' ? (
            <>
              <FiCheckCircle size={16} />
              Saved
            </>
          ) : (
            <>
              <FiSave size={16} />
              {saveState === 'saving' ? 'Saving...' : 'Save Settings'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
