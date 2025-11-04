import React, { useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext'

const API_BASE_URL = 'http://localhost:8000'

export default function HistoryView({ onRerun }) {
  const { settings } = useSettings()
  
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
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE_URL}/history`)
        const data = await res.json()
        setItems(data)
      } catch (e) {
        setError('Failed to load history')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const selectItem = async (id) => {
    setSelectedId(id)
    setSelectedDetail(null)
    try {
      const res = await fetch(`${API_BASE_URL}/history/${id}`)
      const data = await res.json()
      setSelectedDetail(data)
    } catch (e) {
      // ignore
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0, color: theme.text }}>History</h2>
      {loading && <div style={{ color: theme.text }}>Loading...</div>}
      {error && (
        <div style={{ padding: 12, background: '#fee', border: '1px solid #fcc', borderRadius: 6, color: '#c00' }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
        <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, overflow: 'hidden', backgroundColor: theme.cardBg }}>
          <div style={{ padding: 12, background: settings.theme === 'dark' ? '#2d2d2d' : '#f5f5f5', borderBottom: `1px solid ${theme.border}`, color: theme.text }}>
            Sessions
          </div>
          <div>
            {items.map((it) => (
              <div
                key={it.id}
                onClick={() => selectItem(it.id)}
                style={{
                  padding: 12,
                  borderBottom: `1px solid ${theme.border}`,
                  cursor: 'pointer',
                  background: selectedId === it.id ? (settings.theme === 'dark' ? '#1a237e' : '#eef5ff') : theme.cardBg,
                  color: theme.text,
                }}
              >
                <div style={{ fontWeight: 600 }}>{it.title || `Session #${it.id}`}</div>
                <div style={{ fontSize: 12, color: settings.theme === 'dark' ? '#999' : '#666' }}>{new Date(it.created_at).toLocaleString()}</div>
              </div>
            ))}
            {items.length === 0 && !loading && (
              <div style={{ padding: 12, color: theme.text }}>No sessions yet.</div>
            )}
          </div>
        </div>

        <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, overflow: 'hidden', backgroundColor: theme.cardBg }}>
          <div style={{ padding: 12, background: settings.theme === 'dark' ? '#2d2d2d' : '#f5f5f5', borderBottom: `1px solid ${theme.border}`, color: theme.text }}>
            Details
          </div>
          <div style={{ padding: 12, color: theme.text }}>
            {selectedDetail ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <button
                    onClick={() => onRerun && onRerun(selectedDetail.code)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#007bff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
                    Re-run Explanation
                  </button>
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>Overview</div>
                <div style={{
                  padding: 12,
                  background: settings.theme === 'dark' ? '#1e1e1e' : '#f9f9f9',
                  border: `1px solid ${theme.border}`,
                  borderRadius: 6,
                  whiteSpace: 'pre-wrap',
                  color: theme.text,
                }}>
                  {selectedDetail.response.overview || '(no overview)'}
                </div>
                <div style={{ marginTop: 16, fontWeight: 600 }}>Code</div>
                <pre style={{
                  padding: 12,
                  background: settings.theme === 'dark' ? '#0f172a' : '#f5f5f5',
                  color: settings.theme === 'dark' ? '#e2e8f0' : theme.text,
                  borderRadius: 6,
                  overflow: 'auto',
                  border: `1px solid ${theme.border}`,
                }}>{selectedDetail.code}</pre>
              </>
            ) : (
              <div style={{ color: theme.text }}>Select a session to view details</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
