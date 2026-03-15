import { useState, useEffect } from 'react';
import '@src/Options.css';
import { withErrorBoundary, withSuspense } from '@agent-guard/shared';
import { t } from '@agent-guard/i18n';
import { GeneralSettings } from './components/GeneralSettings';
import { ModelSettings } from './components/ModelSettings';
import { FirewallSettings } from './components/FirewallSettings';
import { AnalyticsSettings } from './components/AnalyticsSettings';
import { SecurityLogSettings } from './components/SecurityLogSettings';
import { PoisoningTimeline } from './components/PoisoningTimeline';
import { SecurityDashboard } from './components/SecurityDashboard';
import { MCPSettings } from './components/MCPSettings';
import {
  FiSettings,
  FiCpu,
  FiShield,
  FiTrendingUp,
  FiHelpCircle,
  FiLock,
  FiActivity,
  FiBarChart2,
  FiTool,
  FiSun,
  FiMoon,
} from 'react-icons/fi';

type TabTypes =
  | 'general'
  | 'models'
  | 'firewall'
  | 'security'
  | 'analytics'
  | 'timeline'
  | 'dashboard'
  | 'mcp'
  | 'help';

type TabGroup = {
  label: string;
  tabs: { id: TabTypes; icon: React.ComponentType<{ className?: string }>; label: string }[];
};

const TAB_GROUPS: TabGroup[] = [
  {
    label: 'Configuration',
    tabs: [
      { id: 'general', icon: FiSettings, label: t('options_tabs_general') },
      { id: 'models', icon: FiCpu, label: t('options_tabs_models') },
      { id: 'mcp', icon: FiTool, label: 'MCP Tools' },
    ],
  },
  {
    label: 'Security',
    tabs: [
      { id: 'firewall', icon: FiShield, label: t('options_tabs_firewall') },
      { id: 'security', icon: FiLock, label: 'Security Log' },
      { id: 'timeline', icon: FiActivity, label: 'Poisoning Timeline' },
      { id: 'dashboard', icon: FiTrendingUp, label: 'Security Dashboard' },
    ],
  },
  {
    label: 'Insights',
    tabs: [
      { id: 'analytics', icon: FiBarChart2, label: 'Analytics' },
      { id: 'help', icon: FiHelpCircle, label: t('options_tabs_help') },
    ],
  },
];

const ALL_TABS = TAB_GROUPS.flatMap(g => g.tabs);

const ShieldLogo = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
    <path
      d="M12 2L3.5 6v5.5C3.5 16.65 7.2 21.38 12 22.5c4.8-1.12 8.5-5.85 8.5-11V6L12 2z"
      fill="white"
      fillOpacity="0.95"
    />
    <path
      d="M9 12l2 2 4-4"
      stroke="rgba(99,102,241,0.9)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const focusRingClasses =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guard-primary focus-visible:shadow-lg focus-visible:shadow-guard-primary/30';

const Options = () => {
  const [activeTab, setActiveTab] = useState<TabTypes>('models');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load dark mode: stored preference wins, else follow system
  useEffect(() => {
    const stored = localStorage.getItem('agent-guard:theme');
    if (stored === 'dark' || stored === 'light') {
      setIsDarkMode(stored === 'dark');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('agent-guard:theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const handleTabClick = (tabId: TabTypes) => {
    setActiveTab(tabId);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings isDarkMode={isDarkMode} />;
      case 'models':
        return <ModelSettings isDarkMode={isDarkMode} />;
      case 'mcp':
        return <MCPSettings isDarkMode={isDarkMode} />;
      case 'firewall':
        return <FirewallSettings isDarkMode={isDarkMode} />;
      case 'security':
        return <SecurityLogSettings isDarkMode={isDarkMode} />;
      case 'analytics':
        return <AnalyticsSettings isDarkMode={isDarkMode} />;
      case 'timeline':
        return <PoisoningTimeline isDarkMode={isDarkMode} />;
      case 'dashboard':
        return <SecurityDashboard isDarkMode={isDarkMode} />;
      case 'help':
        return (
          <div className="settings-card space-y-6">
            <p className="text-sm opacity-70">
              Agent Guard is a security-focused multi-agent browser extension. Use the tabs on the left to configure
              models, firewall rules, and review security logs.
            </p>
            <div className="space-y-3 text-xs opacity-60">
              <p>
                <span className="font-bold">Security Log</span> — view every prompt-injection attempt and sanitisation
                event.
              </p>
              <p>
                <span className="font-bold">Poisoning Timeline</span> — per-task attack sequence visualisation.
              </p>
              <p>
                <span className="font-bold">Security Dashboard</span> — aggregate analytics across all sessions.
              </p>
              <p>
                <span className="font-bold">Firewall</span> — manage domain allow/deny lists.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const activeLabel = ALL_TABS.find(tab => tab.id === activeTab)?.label ?? '';

  return (
    <div className={`flex min-h-screen font-sans ${isDarkMode ? 'dark bg-black text-[#f5f5f7]' : 'light bg-[#F2F2F7] text-[#1d1d1f]'}`}>
      {/* Sidebar */}
      <nav className="w-60 glass border-r h-screen sticky top-0 flex flex-col">
        {/* Logo */}
        <div className="px-5 pt-7 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-guard-primary to-cyan-500 shadow-lg shadow-guard-primary/30">
              <ShieldLogo />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold font-['Outfit'] tracking-tight leading-none">
                Agent Guard
              </h1>
              <p className="text-[9px] uppercase tracking-widest opacity-40 font-semibold mt-1">
                Management Console
              </p>
            </div>
          </div>
        </div>

        <div className={`mx-4 h-px ${isDarkMode ? 'bg-white/10' : 'bg-black/8'}`} />

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto py-3 px-2" role="tablist" aria-label="Agent Guard settings tabs">
          {TAB_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
              <p className={`px-3 mb-1 text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {group.label}
              </p>
              {group.tabs.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  id={`options-tab-${item.id}`}
                  role="tab"
                  aria-selected={activeTab === item.id}
                  aria-controls={`options-panel-${item.id}`}
                  className={`sidebar-item w-full ${activeTab === item.id ? 'active' : ''} ${focusRingClasses}`}>
                  <item.icon className="size-4 shrink-0" />
                  <span className="text-[13px]">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`m-3 rounded-2xl px-3 py-2.5 flex items-center justify-between ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
          <div className="min-w-0">
            <p className={`text-[11px] font-semibold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              v1.0.0
            </p>
            <p className="text-[10px] opacity-40 truncate">Protective Multi-Agent</p>
          </div>
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 ${
              isDarkMode
                ? 'bg-slate-700 text-yellow-300 hover:bg-slate-600'
                : 'bg-white text-slate-500 hover:bg-slate-100 shadow-sm'
            }`}>
            {isDarkMode ? <FiSun size={13} /> : <FiMoon size={13} />}
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div
          className="max-w-4xl mx-auto"
          id={`options-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`options-tab-${activeTab}`}>
          <header className="mb-8">
            <h2 className="settings-header">{activeLabel}</h2>
          </header>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">{renderTabContent()}</div>
        </div>
      </main>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <div>Loading...</div>), <div>Error Occurred</div>);
