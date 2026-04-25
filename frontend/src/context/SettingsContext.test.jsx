/**
 * Tests for ``SettingsProvider`` / ``useSettings``: defaults, hydration, merge,
 * persistence, and hook misuse guardrails.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider, useSettings } from './SettingsContext';

function SettingsConsumer() {
  const { settings, updateSettings, loading } = useSettings();

  return (
    <div>
      <div data-testid="theme">{settings.theme}</div>
      <div data-testid="fontSize">{String(settings.fontSize)}</div>
      <div data-testid="language">{settings.language}</div>
      <div data-testid="editorTheme">{settings.editorTheme}</div>
      <div data-testid="loading">{String(loading)}</div>
      <button onClick={() => updateSettings({ theme: 'dark' })}>set-dark</button>
      <button onClick={() => updateSettings({ fontSize: 18 })}>set-font-18</button>
      <button onClick={() => updateSettings({ language: 'java', editorTheme: 'vscDarkPlus' })}>
        set-lang-and-editor
      </button>
    </div>
  );
}

describe('SettingsContext edge cases', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // Test 1: ensures provider exposes default settings when localStorage is empty.
  it('uses default settings when storage has no saved data', async () => {
    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(screen.getByTestId('fontSize').textContent).toBe('14');
    expect(screen.getByTestId('language').textContent).toBe('python');
    expect(screen.getByTestId('editorTheme').textContent).toBe('default');
  });

  // Test 2: ensures valid JSON from localStorage hydrates state on mount.
  it('hydrates from valid localStorage payload', async () => {
    localStorage.setItem(
      'codemuse_settings',
      JSON.stringify({ theme: 'dark', fontSize: 20, language: 'javascript', editorTheme: 'okaidia' })
    );

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('fontSize').textContent).toBe('20');
    expect(screen.getByTestId('language').textContent).toBe('javascript');
    expect(screen.getByTestId('editorTheme').textContent).toBe('okaidia');
  });

  // Test 3: ensures invalid JSON does not crash and falls back to defaults.
  it('falls back to defaults when storage payload is invalid JSON', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('codemuse_settings', '{invalid-json');

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(consoleSpy).toHaveBeenCalled();
  });

  // Test 4: ensures partial saved data merges with default values (missing keys preserved).
  it('merges partial saved settings with defaults', async () => {
    localStorage.setItem('codemuse_settings', JSON.stringify({ theme: 'dark' }));

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('fontSize').textContent).toBe('14');
    expect(screen.getByTestId('language').textContent).toBe('python');
  });

  // Test 5: ensures updateSettings performs a shallow merge instead of replacing object.
  it('updates only provided keys and keeps other values unchanged', async () => {
    const user = userEvent.setup();

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByText('set-dark'));
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('fontSize').textContent).toBe('14');
  });

  // Test 6: ensures updates are persisted into localStorage once loading is complete.
  it('persists updated settings to localStorage', async () => {
    const user = userEvent.setup();

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByText('set-font-18'));

    const saved = JSON.parse(localStorage.getItem('codemuse_settings') || '{}');
    expect(saved.fontSize).toBe(18);
  });

  // Test 7: ensures multiple fields can be updated in one call.
  it('applies multi-field updates in a single updateSettings call', async () => {
    const user = userEvent.setup();

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByText('set-lang-and-editor'));
    expect(screen.getByTestId('language').textContent).toBe('java');
    expect(screen.getByTestId('editorTheme').textContent).toBe('vscDarkPlus');
  });

  // Test 8: ensures hook throws clear error if used outside provider.
  it('throws when useSettings is called without SettingsProvider', () => {
    function BrokenConsumer() {
      useSettings();
      return <div>broken</div>;
    }

    expect(() => render(<BrokenConsumer />)).toThrow('useSettings must be used within SettingsProvider');
  });

  // Test 9: ensures provider completes initialization and exits loading state.
  it('initializes loading state lifecycle correctly', async () => {
    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
  });

  // Test 10: ensures saved unknown keys are preserved by shallow merge behavior.
  it('keeps unknown keys from storage payload in persisted object', async () => {
    localStorage.setItem('codemuse_settings', JSON.stringify({ customFlag: true }));
    const user = userEvent.setup();

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByText('set-dark'));

    const saved = JSON.parse(localStorage.getItem('codemuse_settings') || '{}');
    expect(saved.customFlag).toBe(true);
    expect(saved.theme).toBe('dark');
  });
});
