import React, { useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

const API_BASE_URL = 'http://localhost:8000'

export default function HistoryView({ onRerun }) {
  const { settings } = useSettings()
  
  const themeStyles = {
    light: {
      bg: '#ffffff',
      surface: '#f8f9fa',
      surfaceElevated: '#ffffff',
      text: '#1a1a1a',
      textSecondary: '#6c757d',
      border: '#dee2e6',
      primary: '#0066cc',
      primaryHover: '#0052a3',
      error: '#dc3545',
      shadow: '0 2px 8px rgba(0,0,0,0.08)',
    },
    dark: {
      bg: '#0d1117',
      surface: '#161b22',
      surfaceElevated: '#1c2128',
      text: '#e6edf3',
      textSecondary: '#8b949e',
      border: '#30363d',
      primary: '#58a6ff',
      primaryHover: '#79c0ff',
      error: '#f85149',
      shadow: '0 2px 8px rgba(0,0,0,0.3)',
    },
  }

  const theme = themeStyles[settings.theme] || themeStyles.light
  const codeTheme = settings.theme === 'dark' ? vscDarkPlus : oneLight;
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

  const deleteSession = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this session?')) {
      return
    }
    try {
      const res = await fetch(`${API_BASE_URL}/history/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setItems(items.filter(item => item.id !== id))
        if (selectedId === id) {
          setSelectedId(null)
          setSelectedDetail(null)
        }
      } else {
        alert('Failed to delete session')
      }
    } catch (e) {
      alert('Failed to delete session: ' + (e.message || 'Unknown error'))
    }
  }

  const deleteAllSessions = async () => {
    if (!window.confirm('Are you sure you want to delete ALL sessions? This cannot be undone.')) {
      return
    }
    try {
      const res = await fetch(`${API_BASE_URL}/history`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setItems([])
        setSelectedId(null)
        setSelectedDetail(null)
      } else {
        alert('Failed to delete all sessions')
      }
    } catch (e) {
      alert('Failed to delete all sessions: ' + (e.message || 'Unknown error'))
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h2 style={{ 
          marginTop: 0, 
          fontSize: '32px',
          fontWeight: 700,
          color: theme.text,
          marginBottom: '8px',
        }}>
          Session History
        </h2>
        <p style={{ color: theme.textSecondary, fontSize: '16px' }}>
          View and re-run your past code explanations
        </p>
      </div>

      {loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: theme.textSecondary,
        }}>
          <div style={{ fontSize: '18px' }}>Loading sessions...</div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: settings.theme === 'dark' ? '#3d1f1f' : '#fff5f5',
          border: `1px solid ${theme.error || '#dc3545'}`,
          borderRadius: '8px',
          marginBottom: '24px',
          color: theme.error || '#dc3545',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
        {/* Sessions List */}
        <div style={{ 
          border: `1px solid ${theme.border}`, 
          borderRadius: '12px', 
          overflow: 'hidden',
          backgroundColor: theme.surfaceElevated,
          boxShadow: theme.shadow,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ 
            padding: '16px 20px', 
            background: theme.surface, 
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 600, fontSize: '16px', color: theme.text }}>
              Sessions ({items.length})
            </span>
            {items.length > 0 && (
              <button
                onClick={deleteAllSessions}
                style={{
                  padding: '6px 12px',
                  backgroundColor: theme.error,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = settings.theme === 'dark' ? '#c93c37' : '#c82333'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = theme.error
                }}
                title="Delete all sessions"
              >
                Delete All
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.map((it) => (
              <div
                key={it.id}
                onClick={() => selectItem(it.id)}
                style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid ${theme.border}`,
                  cursor: 'pointer',
                  background: selectedId === it.id 
                    ? (settings.theme === 'dark' ? '#1a237e' : '#e3f2fd') 
                    : theme.surfaceElevated,
                  color: theme.text,
                  transition: 'background-color 0.2s',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (selectedId !== it.id) {
                    e.currentTarget.style.backgroundColor = theme.surface
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedId !== it.id) {
                    e.currentTarget.style.backgroundColor = theme.surfaceElevated
                  }
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px', paddingRight: '60px' }}>
                  {it.title || `Session #${it.id}`}
                </div>
                <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {new Date(it.created_at).toLocaleString()}
                </div>
                <button
                  onClick={(e) => deleteSession(it.id, e)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    color: theme.error,
                    border: `1px solid ${theme.error}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = theme.error
                    e.target.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent'
                    e.target.style.color = theme.error
                  }}
                  title="Delete this session"
                >
                  Delete
                </button>
              </div>
            ))}
            {items.length === 0 && !loading && (
              <div style={{ 
                padding: '40px 20px', 
                textAlign: 'center',
                color: theme.textSecondary,
              }}>
                <div>No sessions yet.</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  Generate explanations to see them here
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details Panel */}
        <div style={{ 
          border: `1px solid ${theme.border}`, 
          borderRadius: '12px', 
          overflow: 'hidden',
          backgroundColor: theme.surfaceElevated,
          boxShadow: theme.shadow,
        }}>
          <div style={{ 
            padding: '16px 20px', 
            background: theme.surface, 
            borderBottom: `1px solid ${theme.border}`,
            fontWeight: 600,
            fontSize: '16px',
            color: theme.text,
          }}>
            Details
          </div>
          <div style={{ padding: '24px', color: theme.text }}>
            {selectedDetail ? (
              <>
                <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => onRerun && onRerun(selectedDetail.code)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: theme.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      boxShadow: theme.shadow,
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = theme.primaryHover;
                      e.target.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = theme.primary;
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    Re-run Explanation
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm('Are you sure you want to delete this session?')) {
                        return
                      }
                      try {
                        const res = await fetch(`${API_BASE_URL}/history/${selectedDetail.id}`, {
                          method: 'DELETE',
                        })
                        if (res.ok) {
                          setItems(items.filter(item => item.id !== selectedDetail.id))
                          setSelectedId(null)
                          setSelectedDetail(null)
                        } else {
                          alert('Failed to delete session')
                        }
                      } catch (e) {
                        alert('Failed to delete session: ' + (e.message || 'Unknown error'))
                      }
                    }}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: theme.error,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = settings.theme === 'dark' ? '#c93c37' : '#c82333';
                      e.target.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = theme.error;
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    Delete Session
                  </button>
                </div>
                <div style={{ marginBottom: '16px', fontWeight: 600, fontSize: '16px' }}>Overview</div>
                <div style={{
                  padding: '16px',
                  background: theme.surface,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  whiteSpace: 'pre-wrap',
                  color: theme.text,
                  lineHeight: '1.7',
                  fontSize: '14px',
                }}>
                  {selectedDetail.response.overview || '(no overview)'}
                </div>
                <div style={{ marginTop: '24px', marginBottom: '16px', fontWeight: 600, fontSize: '16px' }}>Code</div>
                <div style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}>
                  <SyntaxHighlighter
                    language={settings.language || 'python'}
                    style={codeTheme}
                    customStyle={{
                      margin: 0,
                      fontSize: `${settings.fontSize}px`,
                    }}
                    showLineNumbers
                  >
                    {selectedDetail.code}
                  </SyntaxHighlighter>
                </div>
              </>
            ) : (
              <div style={{ 
                textAlign: 'center',
                padding: '60px 20px',
                color: theme.textSecondary,
              }}>
                <div>Select a session to view details</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
