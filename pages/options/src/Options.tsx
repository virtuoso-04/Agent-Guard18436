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
import {
  FiSettings,
  FiCpu,
  FiShield,
  FiTrendingUp,
  FiHelpCircle,
  FiLock,
  FiActivity,
  FiBarChart2,
} from 'react-icons/fi';

type TabTypes = 'general' | 'models' | 'firewall' | 'security' | 'analytics' | 'timeline' | 'dashboard' | 'help';

const TABS: { id: TabTypes; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'general', icon: FiSettings, label: t('options_tabs_general') },
  { id: 'models', icon: FiCpu, label: t('options_tabs_models') },
  { id: 'firewall', icon: FiShield, label: t('options_tabs_firewall') },
  { id: 'security', icon: FiLock, label: 'Security Log' },
  { id: 'timeline', icon: FiActivity, label: 'Poisoning Timeline' },
  { id: 'dashboard', icon: FiTrendingUp, label: 'Security Dashboard' },
  { id: 'analytics', icon: FiBarChart2, label: 'Analytics' },
  { id: 'help', icon: FiHelpCircle, label: t('options_tabs_help') },
];

const focusRingClasses =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guard-primary focus-visible:shadow-lg focus-visible:shadow-guard-primary/30';

const Options = () => {
  const [activeTab, setActiveTab] = useState<TabTypes>('models');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Check for dark mode preference
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    darkModeMediaQuery.addEventListener('change', handleChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleTabClick = (tabId: TabTypes) => {
    setActiveTab(tabId);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings isDarkMode={isDarkMode} />;
      case 'models':
        return <ModelSettings isDarkMode={isDarkMode} />;
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

  return (
    <div className={`flex min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F2F2F7]'} font-sans`}>
      {/* Sidebar */}
      <nav className="w-64 glass border-r h-screen sticky top-0 flex flex-col pt-8">
        <div className="px-6 mb-8">
          <h1 className="text-xl font-bold font-['Outfit'] tracking-tight bg-gradient-to-r from-guard-primary to-cyan-500 bg-clip-text text-transparent">
            Agent Guard
          </h1>
          <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold mt-1">Management Console</p>
        </div>

        <div className="flex-1 px-2" role="tablist" aria-label="Agent Guard settings tabs">
          {TABS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item.id)}
              id={`options-tab-${item.id}`}
              role="tab"
              aria-selected={activeTab === item.id}
              aria-controls={`options-panel-${item.id}`}
              className={`sidebar-item w-[calc(100%-16px)] ${activeTab === item.id ? 'active' : ''} ${focusRingClasses}`}>
              <item.icon className="size-5" />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6 opacity-40 hover:opacity-100 transition-opacity">
          <p className="text-[10px] font-medium">Agent Guard v1.0.0</p>
          <p className="text-[10px]">Protective Multi-Agent System</p>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <div
          className="max-w-4xl mx-auto"
          id={`options-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`options-tab-${activeTab}`}>
          <header className="mb-12">
            <h2 className="settings-header">{TABS.find(t => t.id === activeTab)?.label}</h2>
          </header>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">{renderTabContent()}</div>
        </div>
      </main>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <div>Loading...</div>), <div>Error Occurred</div>);
