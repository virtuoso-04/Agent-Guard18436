import { useState, useEffect } from 'react';
import '@src/Options.css';
import { Button } from '@extension/ui';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { t } from '@extension/i18n';
import { GeneralSettings } from './components/GeneralSettings';
import { ModelSettings } from './components/ModelSettings';
import { FirewallSettings } from './components/FirewallSettings';
import { AnalyticsSettings } from './components/AnalyticsSettings';
import { SecurityLogSettings } from './components/SecurityLogSettings';
import { PoisoningTimeline } from './components/PoisoningTimeline';
import { SecurityDashboard } from './components/SecurityDashboard';
import { FiSettings, FiCpu, FiShield, FiTrendingUp, FiHelpCircle, FiLock, FiActivity } from 'react-icons/fi';

type TabTypes = 'general' | 'models' | 'firewall' | 'security' | 'analytics' | 'timeline' | 'dashboard' | 'help';

const TABS: { id: TabTypes; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'general', icon: FiSettings, label: t('options_tabs_general') },
  { id: 'models', icon: FiCpu, label: t('options_tabs_models') },
  { id: 'firewall', icon: FiShield, label: t('options_tabs_firewall') },
  { id: 'security', icon: FiLock, label: 'Security Log' },
  { id: 'timeline', icon: FiActivity, label: 'Poisoning Timeline' },
  { id: 'dashboard', icon: FiTrendingUp, label: 'Security Dashboard' },
  { id: 'analytics', icon: FiTrendingUp, label: 'Analytics' },
  { id: 'help', icon: FiHelpCircle, label: t('options_tabs_help') },
];

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
    if (tabId === 'help') {
      window.open('https://agent-guard.local/docs', '_blank');
    } else {
      setActiveTab(tabId);
    }
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
      default:
        return null;
    }
  };

  return (
    <div className={`flex min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F2F2F7]'} font-sans`}>
      {/* Sidebar */}
      <nav className="w-64 glass border-r h-screen sticky top-0 flex flex-col pt-8">
        <div className="px-6 mb-8">
          <h1 className="text-xl font-bold font-['Outfit'] tracking-tight bg-gradient-to-r from-apple-blue to-cyan-500 bg-clip-text text-transparent">
            Agent Guard
          </h1>
          <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold mt-1">Management Console</p>
        </div>

        <div className="flex-1 px-2">
          {TABS.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`sidebar-item w-[calc(100%-16px)] ${activeTab === item.id ? 'active' : ''}`}>
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
        <div className="max-w-4xl mx-auto">
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
