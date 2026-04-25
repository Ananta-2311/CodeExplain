/**
 * Root layout: header, tab navigation, themed shell, and lazy-loaded feature views.
 *
 * Owns which tab is active (Explain, History, Repositories, Share), opens the
 * settings modal, detects `/share/:token` URLs, and wraps the Repositories tab
 * in an error boundary so a render bug there cannot blank the whole app.
 */
import React, { useState, useEffect, Component } from 'react'
import { useSettings } from './context/SettingsContext'
import ExplanationView from './view/ExplanationView.jsx'
import HistoryView from './view/HistoryView.jsx'
import RepositoriesView from './view/RepositoriesView.jsx'
import SettingsModal from './view/SettingsModal.jsx'
import ShareView from './view/ShareView.jsx'

/**
 * React error boundary: catches child render errors and shows a recovery UI
 * instead of unmounting the entire app shell.
 */
class TabErrorBoundary extends Component {
  /** Initialize empty error state. */
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  /** Store the thrown error so the next render can show a fallback panel. */
  static getDerivedStateFromError(error) {
    return { error }
  }

  /** Log the failure (and React component stack) for debugging. */
  componentDidCatch(error, info) {
    console.error('TabErrorBoundary', error, info?.componentStack)
  }

  /** Either render children or the inline “tab crashed” message with retry. */
  render() {
    const { theme, children } = this.props
    const { error } = this.state
    if (error) {
      return (
        <div style={{
          padding: '32px 24px',
          maxWidth: 720,
          margin: '0 auto',
          color: theme?.text || '#222',
          backgroundColor: theme?.surfaceElevated || '#fff',
          borderRadius: 12,
          border: `1px solid ${theme?.border || '#dee2e6'}`,
        }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>This tab crashed</h2>
          <p style={{ color: theme?.textSecondary || '#555', lineHeight: 1.5 }}>
            Something went wrong while rendering this screen. You can switch to another tab and come back, or reload the page.
          </p>
          <pre style={{
            fontSize: 13,
            overflow: 'auto',
            padding: 12,
            background: theme?.surface || '#f5f5f5',
            borderRadius: 8,
            color: theme?.error || '#b00020',
          }}
          >
            {String(error?.message || error)}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 8,
              border: 'none',
              background: theme?.primary || '#0066cc',
              color: '#fff',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return children
  }
}

/**
 * Inner app shell: tabs, theme tokens, main content switcher, and settings modal state.
 */
function AppContent() {
  const { settings } = useSettings()
  const [activeTab, setActiveTab] = useState('explain')
  const [shareToken, setShareToken] = useState(null)
  const [sharedCode, setSharedCode] = useState('')
  const [autoRun, setAutoRun] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Check for share token in URL
  useEffect(() => {
    const path = window.location.pathname
    const match = path.match(/^\/share\/(.+)$/)
    if (match) {
      setShareToken(match[1])
      setActiveTab('share')
    }
  }, [])

  /** Switches to Explain tab and triggers a one-shot auto explanation for `code`. */
  const handleRerun = (code) => {
    setSharedCode(code)
    setAutoRun(true)
    setActiveTab('explain')
  }

  /** Inline palette tokens keyed by theme name (mirrors view components). */
  const themeStyles = {
    light: {
      bg: '#ffffff',
      surface: '#f8f9fa',
      surfaceElevated: '#ffffff',
      text: '#1a1a1a',
      textSecondary: '#6c757d',
      border: '#dee2e6',
      borderLight: '#e9ecef',
      primary: '#0066cc',
      primaryHover: '#0052a3',
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
      codeBg: '#f8f9fa',
      shadow: '0 2px 8px rgba(0,0,0,0.08)',
      shadowHover: '0 4px 12px rgba(0,0,0,0.12)',
    },
    dark: {
      bg: '#0d1117',
      surface: '#161b22',
      surfaceElevated: '#1c2128',
      text: '#e6edf3',
      textSecondary: '#8b949e',
      border: '#30363d',
      borderLight: '#21262d',
      primary: '#58a6ff',
      primaryHover: '#79c0ff',
      success: '#3fb950',
      error: '#f85149',
      warning: '#d29922',
      codeBg: '#0d1117',
      shadow: '0 2px 8px rgba(0,0,0,0.3)',
      shadowHover: '0 4px 12px rgba(0,0,0,0.4)',
    },
  }

  const theme = themeStyles[settings.theme] || themeStyles.light

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      minHeight: '100vh',
      backgroundColor: theme.bg,
      color: theme.text,
      transition: 'background-color 0.2s, color 0.2s',
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: theme.surface,
        borderBottom: `1px solid ${theme.border}`,
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: theme.shadow,
      }}>
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ 
              margin: 0, 
              fontSize: '24px',
              fontWeight: 700,
              ...(settings.theme === 'dark' 
                ? {
                    color: '#58a6ff', // Solid bright blue for dark mode - always visible
                  }
                : {
                    background: `linear-gradient(135deg, ${theme.primary} 0%, #004085 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    color: theme.primary, // Fallback
                  }
              ),
            }}>
              CodeMuse
            </h1>
            <span style={{ 
              fontSize: '14px', 
              color: theme.textSecondary,
              fontWeight: 500,
            }}>
              Learn Code Through AI Explanations
            </span>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              padding: '8px 16px',
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              backgroundColor: theme.surfaceElevated,
              color: theme.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = settings.theme === 'dark' ? '#21262d' : '#e9ecef'
              e.target.style.borderColor = theme.primary
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = theme.surfaceElevated
              e.target.style.borderColor = theme.border
            }}
            title="Settings"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav style={{
        backgroundColor: theme.surface,
        borderBottom: `1px solid ${theme.border}`,
        padding: '0 24px',
      }}>
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto',
          display: 'flex',
          gap: '4px',
        }}>
          {[
            { id: 'explain', label: 'Explain Code', desc: 'Get AI explanations' },
            { id: 'history', label: 'History', desc: 'Past sessions' },
            { id: 'repositories', label: 'Repositories', desc: 'Upload & chat with codebases' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderBottom: `3px solid ${activeTab === tab.id ? theme.primary : 'transparent'}`,
                borderRadius: '8px 8px 0 0',
                backgroundColor: activeTab === tab.id ? theme.surfaceElevated : 'transparent',
                color: activeTab === tab.id ? theme.primary : theme.textSecondary,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? 600 : 500,
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '2px',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = theme.surfaceElevated
                  e.target.style.color = theme.text
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = 'transparent'
                  e.target.style.color = theme.textSecondary
                }
              }}
            >
              <span>{tab.label}</span>
              <span style={{ fontSize: '11px', opacity: 0.7 }}>{tab.desc}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '32px 24px',
      }}>
        {activeTab === 'explain' && (
          <ExplanationView initialCode={sharedCode} autoRun={autoRun} onAutoRunConsumed={() => setAutoRun(false)} />
        )}
        {activeTab === 'history' && (
          <HistoryView onRerun={handleRerun} />
        )}
        {activeTab === 'repositories' && (
          <TabErrorBoundary theme={theme}>
            <RepositoriesView />
          </TabErrorBoundary>
        )}
        {activeTab === 'share' && shareToken && (
          <ShareView token={shareToken} />
        )}
      </main>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

/** Application root component mounted from ``main.jsx`` (delegates to ``AppContent``). */
export default function App() {
  return <AppContent />
}
