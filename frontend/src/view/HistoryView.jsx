import React, { useEffect, useState } from 'react'

const API_BASE_URL = 'http://localhost:8000'

export default function HistoryView({ onRerun }) {
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
      <h2 style={{ marginTop: 0 }}>History</h2>
      {loading && <div>Loading...</div>}
      {error && (
        <div style={{ padding: 12, background: '#fee', border: '1px solid #fcc', borderRadius: 6 }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: 12, background: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
            Sessions
          </div>
          <div>
            {items.map((it) => (
              <div
                key={it.id}
                onClick={() => selectItem(it.id)}
                style={{
                  padding: 12,
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  background: selectedId === it.id ? '#eef5ff' : '#fff'
                }}
              >
                <div style={{ fontWeight: 600 }}>{it.title || `Session #${it.id}`}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{new Date(it.created_at).toLocaleString()}</div>
              </div>
            ))}
            {items.length === 0 && !loading && (
              <div style={{ padding: 12, color: '#666' }}>No sessions yet.</div>
            )}
          </div>
        </div>

        <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: 12, background: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
            Details
          </div>
          <div style={{ padding: 12 }}>
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
                <div style={{ marginBottom: 8, color: '#333', fontWeight: 600 }}>Overview</div>
                <div style={{
                  padding: 12,
                  background: '#f9f9f9',
                  border: '1px solid #eee',
                  borderRadius: 6,
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedDetail.response.overview || '(no overview)'}
                </div>
                <div style={{ marginTop: 16, color: '#333', fontWeight: 600 }}>Code</div>
                <pre style={{
                  padding: 12,
                  background: '#0f172a',
                  color: '#e2e8f0',
                  borderRadius: 6,
                  overflow: 'auto'
                }}>{selectedDetail.code}</pre>
              </>
            ) : (
              <div style={{ color: '#666' }}>Select a session to view details</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
