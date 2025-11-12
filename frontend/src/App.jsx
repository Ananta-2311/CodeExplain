import React, { useState, useEffect } from 'react'
import { useSettings } from './context/SettingsContext'
import ExplanationView from './view/ExplanationView.jsx'
import HistoryView from './view/HistoryView.jsx'
import SettingsModal from './view/SettingsModal.jsx'
import AdminView from './view/AdminView.jsx'
import ShareView from './view/ShareView.jsx'

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

  const handleRerun = (code) => {
    setSharedCode(code)
    setAutoRun(true)
    setActiveTab('explain')
  }

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
            { id: 'admin', label: 'Admin', desc: 'Dashboard' },
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
        {activeTab === 'admin' && (
          <AdminView />
        )}
        {activeTab === 'share' && shareToken && (
          <ShareView token={shareToken} />
        )}
      </main>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export default function App() {
  return <AppContent />
}
