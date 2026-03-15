import { useState, useEffect } from 'react';
import { type GeneralSettingsConfig, generalSettingsStore, DEFAULT_GENERAL_SETTINGS } from '@agent-guard/storage';
import { t } from '@agent-guard/i18n';

interface GeneralSettingsProps {
  isDarkMode?: boolean;
}

export const GeneralSettings = ({ isDarkMode = false }: GeneralSettingsProps) => {
  const [settings, setSettings] = useState<GeneralSettingsConfig>(DEFAULT_GENERAL_SETTINGS);

  useEffect(() => {
    // Load initial settings
    generalSettingsStore.getSettings().then(setSettings);
  }, []);

  const updateSetting = async <K extends keyof GeneralSettingsConfig>(key: K, value: GeneralSettingsConfig[K]) => {
    // Optimistically update the local state for responsiveness
    setSettings(prevSettings => ({ ...prevSettings, [key]: value }));

    // Call the store to update the setting
    await generalSettingsStore.updateSettings({ [key]: value } as Partial<GeneralSettingsConfig>);

    // After the store update (which might have side effects, e.g., useVision affecting displayHighlights),
    // fetch the latest settings from the store and update the local state again to ensure UI consistency.
    const latestSettings = await generalSettingsStore.getSettings();
    setSettings(latestSettings);
  };

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="settings-card">
        <h3 className="text-sm font-bold uppercase tracking-widest opacity-40 mb-6 border-b pb-2">
          {t('options_general_header')}
        </h3>

        <div className="space-y-8">
          <div className="flex items-center justify-between group">
            <div className="max-w-[70%]">
              <h4 className="text-base font-semibold mb-1">{t('options_general_maxSteps')}</h4>
              <p className="text-sm opacity-60">{t('options_general_maxSteps_desc')}</p>
            </div>
            <input
              id="maxSteps"
              type="number"
              min={1}
              max={50}
              value={settings.maxSteps}
              onChange={e => updateSetting('maxSteps', Number.parseInt(e.target.value, 10))}
              className={`w-24 rounded-xl border p-3 text-center font-bold glass ${isDarkMode ? 'border-apple-dark-border' : 'border-apple-border'} outline-none focus:ring-2 focus:ring-guard-primary transition-all`}
            />
          </div>

          <div className="flex items-center justify-between group">
            <div className="max-w-[70%]">
              <h4 className="text-base font-semibold mb-1">{t('options_general_maxActions')}</h4>
              <p className="text-sm opacity-60">{t('options_general_maxActions_desc')}</p>
            </div>
            <input
              id="maxActionsPerStep"
              type="number"
              min={1}
              max={50}
              value={settings.maxActionsPerStep}
              onChange={e => updateSetting('maxActionsPerStep', Number.parseInt(e.target.value, 10))}
              className={`w-24 rounded-xl border p-3 text-center font-bold glass outline-none focus:ring-2 focus:ring-guard-primary transition-all`}
            />
          </div>

          <div className="flex items-center justify-between group">
            <div className="max-w-[70%]">
              <h4 className="text-base font-semibold mb-1">{t('options_general_enableVision')}</h4>
              <p className="text-sm opacity-60">{t('options_general_enableVision_desc')}</p>
            </div>
            <div className="relative inline-flex cursor-pointer items-center">
              <input
                id="useVision"
                type="checkbox"
                checked={settings.useVision}
                onChange={e => updateSetting('useVision', e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-7 w-12 rounded-full bg-gray-200 dark:bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-md after:transition-all peer-checked:bg-guard-primary peer-checked:after:translate-x-full" />
            </div>
          </div>

          <div className="flex items-center justify-between group">
            <div className="max-w-[70%]">
              <h4 className="text-base font-semibold mb-1">{t('options_general_replayHistoricalTasks')}</h4>
              <p className="text-sm opacity-60">{t('options_general_replayHistoricalTasks_desc')}</p>
            </div>
            <div className="relative inline-flex cursor-pointer items-center">
              <input
                id="replayHistoricalTasks"
                type="checkbox"
                checked={settings.replayHistoricalTasks}
                onChange={e => updateSetting('replayHistoricalTasks', e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-7 w-12 rounded-full bg-gray-200 dark:bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-md after:transition-all peer-checked:bg-guard-primary peer-checked:after:translate-x-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
