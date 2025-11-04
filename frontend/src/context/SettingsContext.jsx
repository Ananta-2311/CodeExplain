import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  theme: 'light',
  fontSize: 14,
  language: 'python',
  editorTheme: 'default',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('codemuse_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save to localStorage whenever settings change
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('codemuse_settings', JSON.stringify(settings));
    }
  }, [settings, loading]);

  const updateSettings = (newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const value = {
    settings,
    updateSettings,
    loading,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

