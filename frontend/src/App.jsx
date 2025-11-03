import React, { useState } from 'react'
import ExplanationView from './view/ExplanationView.jsx'
import HistoryView from './view/HistoryView.jsx'

export default function App() {
  const [activeTab, setActiveTab] = useState('explain') // 'explain' | 'history'
  const [sharedCode, setSharedCode] = useState('')
  const [autoRun, setAutoRun] = useState(false)

  const handleRerun = (code) => {
    setSharedCode(code)
    setAutoRun(true)
    setActiveTab('explain')
    // autoRun will be consumed by ExplanationView and then reset
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>CodeMuse</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('explain')}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: 6,
            backgroundColor: activeTab === 'explain' ? '#007bff' : '#fff',
            color: activeTab === 'explain' ? '#fff' : '#333',
            cursor: 'pointer'
          }}
        >
          Explain
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: 6,
            backgroundColor: activeTab === 'history' ? '#007bff' : '#fff',
            color: activeTab === 'history' ? '#fff' : '#333',
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
    </div>
  )
}


