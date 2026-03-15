import { useState, useEffect, useCallback } from 'react';
import { firewallStore } from '@agent-guard/storage';
import { Button } from '@agent-guard/ui';
import { t } from '@agent-guard/i18n';

interface FirewallSettingsProps {
  isDarkMode: boolean;
}

export const FirewallSettings = ({ isDarkMode }: FirewallSettingsProps) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [allowList, setAllowList] = useState<string[]>([]);
  const [denyList, setDenyList] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [activeList, setActiveList] = useState<'allow' | 'deny'>('allow');

  const loadFirewallSettings = useCallback(async () => {
    const settings = await firewallStore.getFirewall();
    setIsEnabled(settings.enabled);
    setAllowList(settings.allowList);
    setDenyList(settings.denyList);
  }, []);

  useEffect(() => {
    loadFirewallSettings();
  }, [loadFirewallSettings]);

  const handleToggleFirewall = async () => {
    await firewallStore.updateFirewall({ enabled: !isEnabled });
    await loadFirewallSettings();
  };

  const handleAddUrl = async () => {
    // Remove http:// or https:// prefixes
    const cleanUrl = newUrl.trim().replace(/^https?:\/\//, '');
    if (!cleanUrl) return;

    if (activeList === 'allow') {
      await firewallStore.addToAllowList(cleanUrl);
    } else {
      await firewallStore.addToDenyList(cleanUrl);
    }
    await loadFirewallSettings();
    setNewUrl('');
  };

  const handleRemoveUrl = async (url: string, listType: 'allow' | 'deny') => {
    if (listType === 'allow') {
      await firewallStore.removeFromAllowList(url);
    } else {
      await firewallStore.removeFromDenyList(url);
    }
    await loadFirewallSettings();
  };

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="settings-card">
        <div className="flex items-center justify-between mb-8 border-b pb-4">
          <div>
            <h2 className="text-lg font-bold">Network Firewall</h2>
            <p className="text-sm opacity-60">Control which domains Agent Guard is allowed to interact with.</p>
          </div>
          <div className="relative inline-flex cursor-pointer items-center">
            <input
              id="toggle-firewall"
              type="checkbox"
              checked={isEnabled}
              onChange={handleToggleFirewall}
              className="peer sr-only"
            />
            <div className="peer h-7 w-12 rounded-full bg-gray-200 dark:bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-md after:transition-all peer-checked:bg-guard-primary peer-checked:after:translate-x-full" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex p-1 glass rounded-2xl mb-8">
            <button
              onClick={() => setActiveList('allow')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                activeList === 'allow' ? 'bg-guard-primary text-white shadow-lg' : 'opacity-40 hover:opacity-100'
              }`}>
              Allow List
            </button>
            <button
              onClick={() => setActiveList('deny')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                activeList === 'deny' ? 'bg-guard-primary text-white shadow-lg' : 'opacity-40 hover:opacity-100'
              }`}>
              Deny List
            </button>
          </div>

          <div className="flex gap-3">
            <input
              id="url-input"
              type="text"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddUrl();
              }}
              placeholder="Enter domain (e.g. google.com)"
              className={`flex-1 rounded-2xl border p-4 text-sm glass ${isDarkMode ? 'border-apple-dark-border' : 'border-apple-border'} outline-none focus:ring-2 focus:ring-guard-primary transition-all`}
            />
            <button
              onClick={handleAddUrl}
              className="px-8 py-4 rounded-2xl bg-guard-primary text-white text-xs font-bold uppercase tracking-widest hover:shadow-xl transition-all active:scale-95 shadow-lg">
              Add Domain
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto pr-2 space-y-2">
            {(activeList === 'allow' ? allowList : denyList).map(url => (
              <div
                key={url}
                className="flex items-center justify-between glass p-4 rounded-2xl animate-in slide-in-from-left-2 duration-200">
                <span className="text-sm font-medium">{url}</span>
                <button
                  onClick={() => handleRemoveUrl(url, activeList)}
                  className="text-apple-dark-red opacity-60 hover:opacity-100 p-2">
                  ✕
                </button>
              </div>
            ))}
            {(activeList === 'allow' ? allowList : denyList).length === 0 && (
              <div className="text-center py-12 opacity-30 italic text-sm">No domains in this list yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="settings-card opacity-80">
        <h3 className="text-sm font-bold uppercase tracking-widest opacity-40 mb-4">Security Rules</h3>
        <ul className="space-y-3">
          <li className="text-xs flex gap-3">
            <span className="text-guard-primary font-bold">01</span>
            <span className="opacity-80">The Allow List takes precedence over all other network rules.</span>
          </li>
          <li className="text-xs flex gap-3">
            <span className="text-guard-primary font-bold">02</span>
            <span className="opacity-80">Wildcards are supported (e.g. *.example.com).</span>
          </li>
          <li className="text-xs flex gap-3">
            <span className="text-guard-primary font-bold">03</span>
            <span className="opacity-80">Agent Guard will block all navigation to domains in the Deny List.</span>
          </li>
        </ul>
      </div>
    </section>
  );
};
