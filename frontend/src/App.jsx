import React, { useState } from 'react'
import { useSettings } from './context/SettingsContext'
import ExplanationView from './view/ExplanationView.jsx'
import HistoryView from './view/HistoryView.jsx'
import SettingsModal from './view/SettingsModal.jsx'

function AppContent() {
  const { settings } = useSettings()
  const [activeTab, setActiveTab] = useState('explain') // 'explain' | 'history'
  const [sharedCode, setSharedCode] = useState('')
  const [autoRun, setAutoRun] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleRerun = (code) => {
    setSharedCode(code)
    setAutoRun(true)
    setActiveTab('explain')
    // autoRun will be consumed by ExplanationView and then reset
  }

  const themeStyles = {
    light: {
      bg: '#fff',
      text: '#333',
      border: '#e0e0e0',
      cardBg: '#fff',
    },
    dark: {
      bg: '#1e1e1e',
      text: '#e0e0e0',
      border: '#444',
      cardBg: '#2d2d2d',
    },
  }

  const theme = themeStyles[settings.theme] || themeStyles.light

  return (
    <div style={{ 
      fontFamily: 'sans-serif', 
      padding: 24,
      backgroundColor: theme.bg,
      color: theme.text,
      minHeight: '100vh',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ marginTop: 0, marginBottom: 0 }}>CodeMuse</h1>
        <button
          onClick={() => setSettingsOpen(true)}
          style={{
            padding: '8px 12px',
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            backgroundColor: theme.cardBg,
            color: theme.text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          title="Settings"
        >
          ⚙️ Settings
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('explain')}
          style={{
            padding: '8px 12px',
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            backgroundColor: activeTab === 'explain' ? '#007bff' : theme.cardBg,
            color: activeTab === 'explain' ? '#fff' : theme.text,
            cursor: 'pointer'
          }}
        >
          Explain
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 12px',
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            backgroundColor: activeTab === 'history' ? '#007bff' : theme.cardBg,
            color: activeTab === 'history' ? '#fff' : theme.text,
            cursor: 'pointer'
          }}
        >
          History
        </button>
      </div>

      {activeTab === 'explain' ? (
        <ExplanationView initialCode={sharedCode} autoRun={autoRun} onAutoRunConsumed={() => setAutoRun(false)} />
      ) : (
        <HistoryView onRerun={handleRerun} />
      )}

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export default function App() {
  return <AppContent />
}


