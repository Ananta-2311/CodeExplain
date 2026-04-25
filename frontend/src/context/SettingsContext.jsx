/**
 * Global UI settings (theme, font size, language) with localStorage persistence.
 *
 * ``SettingsProvider`` hydrates from ``codemuse_settings`` on mount and writes
 * back on change. ``useSettings`` exposes read/update to any nested component.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

/** Baseline merged with any saved values from localStorage. */
const DEFAULT_SETTINGS = {
  theme: 'light',
  fontSize: 14,
  language: 'python',
  editorTheme: 'default',
};

/**
 * Provides `settings`, `updateSettings`, and `loading` to descendants.
 */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    /** Hydrate state from `codemuse_settings` or fall back to defaults. */
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

  /** Shallow-merge partial updates into current settings (also persists when not loading). */
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

/** Hook to read/update settings; must run under SettingsProvider. */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

