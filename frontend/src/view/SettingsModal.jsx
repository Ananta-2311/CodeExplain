import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export default function SettingsModal({ isOpen, onClose }) {
  const { settings, updateSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const themeStyles = {
    light: {
      bg: '#ffffff',
      surface: '#f8f9fa',
      text: '#1a1a1a',
      textSecondary: '#6c757d',
      border: '#dee2e6',
      primary: '#0066cc',
      overlay: 'rgba(0,0,0,0.5)',
    },
    dark: {
      bg: '#161b22',
      surface: '#1c2128',
      text: '#e6edf3',
      textSecondary: '#8b949e',
      border: '#30363d',
      primary: '#58a6ff',
      overlay: 'rgba(0,0,0,0.7)',
    },
  };

  const currentTheme = themeStyles[localSettings.theme] || themeStyles.light;

  const handleSave = async () => {
    setSaving(true);
    try {
      updateSettings(localSettings);
      
      try {
        await axios.post(`${API_BASE_URL}/settings`, {
          user_id: 'default',
          theme: localSettings.theme,
          fontSize: localSettings.fontSize,
          language: localSettings.language,
          editorTheme: localSettings.editorTheme,
        });
      } catch (e) {
        console.warn('Failed to save to backend:', e);
      }
      
      onClose();
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: currentTheme.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: currentTheme.bg,
          borderRadius: '12px',
          padding: '32px',
          width: '100%',
          maxWidth: '500px',
          border: `1px solid ${currentTheme.border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: currentTheme.text }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: currentTheme.textSecondary,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = currentTheme.surface
              e.target.style.color = currentTheme.text
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent'
              e.target.style.color = currentTheme.textSecondary
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Theme Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600, color: currentTheme.text, fontSize: '14px' }}>
              Theme
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setLocalSettings({ ...localSettings, theme: 'light' })}
                style={{
                  flex: 1,
                  padding: '16px',
                  border: `2px solid ${localSettings.theme === 'light' ? currentTheme.primary : currentTheme.border}`,
                  borderRadius: '8px',
                  backgroundColor: localSettings.theme === 'light' ? (currentTheme.theme === 'dark' ? '#e3f2fd' : '#f0f7ff') : currentTheme.surface,
                  color: currentTheme.text,
                  cursor: 'pointer',
                  fontWeight: localSettings.theme === 'light' ? 600 : 400,
                  fontSize: '14px',
                  transition: 'all 0.2s',
                }}
              >
                ☀️ Light
              </button>
              <button
                onClick={() => setLocalSettings({ ...localSettings, theme: 'dark' })}
                style={{
                  flex: 1,
                  padding: '16px',
                  border: `2px solid ${localSettings.theme === 'dark' ? currentTheme.primary : currentTheme.border}`,
                  borderRadius: '8px',
                  backgroundColor: localSettings.theme === 'dark' ? (currentTheme.theme === 'dark' ? '#1a237e' : '#0d1117') : currentTheme.surface,
                  color: currentTheme.text,
                  cursor: 'pointer',
                  fontWeight: localSettings.theme === 'dark' ? 600 : 400,
                  fontSize: '14px',
                  transition: 'all 0.2s',
                }}
              >
                🌙 Dark
              </button>
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600, color: currentTheme.text, fontSize: '14px' }}>
              Font Size: {localSettings.fontSize}px
            </label>
            <input
              type="range"
              min="12"
              max="18"
              value={localSettings.fontSize}
              onChange={(e) => setLocalSettings({ ...localSettings, fontSize: parseInt(e.target.value) })}
              style={{ width: '100%', height: '6px', borderRadius: '3px', accentColor: currentTheme.primary }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: currentTheme.textSecondary, marginTop: '4px' }}>
              <span>12px</span>
              <span>18px</span>
            </div>
          </div>

          {/* Language */}
          <div>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600, color: currentTheme.text, fontSize: '14px' }}>
              Programming Language
            </label>
            <select
              value={localSettings.language}
              onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value })}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `1px solid ${currentTheme.border}`,
                borderRadius: '8px',
                backgroundColor: currentTheme.surface,
                color: currentTheme.text,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="java">Java</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '32px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              border: `1px solid ${currentTheme.border}`,
              borderRadius: '8px',
              backgroundColor: currentTheme.surface,
              color: currentTheme.text,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: saving ? currentTheme.border : currentTheme.primary,
              color: 'white',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
