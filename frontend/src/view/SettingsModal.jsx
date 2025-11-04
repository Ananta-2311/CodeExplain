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

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update local context (which saves to localStorage)
      updateSettings(localSettings);
      
      // Optionally save to backend
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
        // Continue anyway - localStorage is the primary storage
      }
      
      onClose();
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const themeStyles = {
    light: {
      bg: '#fff',
      text: '#333',
      border: '#e0e0e0',
      inputBg: '#fff',
    },
    dark: {
      bg: '#1e1e1e',
      text: '#e0e0e0',
      border: '#444',
      inputBg: '#2d2d2d',
    },
  };

  const currentTheme = themeStyles[localSettings.theme] || themeStyles.light;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: currentTheme.bg,
          color: currentTheme.text,
          borderRadius: '8px',
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          border: `1px solid ${currentTheme.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: currentTheme.text,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Theme Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Theme
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setLocalSettings({ ...localSettings, theme: 'light' })}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${localSettings.theme === 'light' ? '#007bff' : currentTheme.border}`,
                  borderRadius: '6px',
                  backgroundColor: localSettings.theme === 'light' ? '#e3f2fd' : currentTheme.inputBg,
                  color: currentTheme.text,
                  cursor: 'pointer',
                  fontWeight: localSettings.theme === 'light' ? '600' : '400',
                }}
              >
                ☀️ Light
              </button>
              <button
                onClick={() => setLocalSettings({ ...localSettings, theme: 'dark' })}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${localSettings.theme === 'dark' ? '#007bff' : currentTheme.border}`,
                  borderRadius: '6px',
                  backgroundColor: localSettings.theme === 'dark' ? '#1a237e' : currentTheme.inputBg,
                  color: currentTheme.text,
                  cursor: 'pointer',
                  fontWeight: localSettings.theme === 'dark' ? '600' : '400',
                }}
              >
                🌙 Dark
              </button>
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Font Size: {localSettings.fontSize}px
            </label>
            <input
              type="range"
              min="10"
              max="20"
              value={localSettings.fontSize}
              onChange={(e) => setLocalSettings({ ...localSettings, fontSize: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          {/* Language */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Language
            </label>
            <select
              value={localSettings.language}
              onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `1px solid ${currentTheme.border}`,
                borderRadius: '6px',
                backgroundColor: currentTheme.inputBg,
                color: currentTheme.text,
                fontSize: '14px',
              }}
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </div>

          {/* Editor Theme */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Editor Theme
            </label>
            <select
              value={localSettings.editorTheme}
              onChange={(e) => setLocalSettings({ ...localSettings, editorTheme: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `1px solid ${currentTheme.border}`,
                borderRadius: '6px',
                backgroundColor: currentTheme.inputBg,
                color: currentTheme.text,
                fontSize: '14px',
              }}
            >
              <option value="default">Default</option>
              <option value="vscDarkPlus">VS Code Dark+</option>
              <option value="github">GitHub</option>
              <option value="atomOneDark">Atom One Dark</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: `1px solid ${currentTheme.border}`,
              borderRadius: '6px',
              backgroundColor: currentTheme.inputBg,
              color: currentTheme.text,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: saving ? '#ccc' : '#007bff',
              color: 'white',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: '600',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

