import React, { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../context/SettingsContext'

const API_BASE_URL = 'http://localhost:8000'

export default function AdminView() {
  const { settings } = useSettings()
  const [token, setToken] = useState(localStorage.getItem('codemuse_admin_token') || '')
  const [inputToken, setInputToken] = useState('')
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState([])
  const [keys, setKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [error, setError] = useState(null)

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
      borderLight: '#21262d',
      primary: '#58a6ff',
      error: '#f85149',
      shadow: '0 2px 8px rgba(0,0,0,0.3)',
    },
  }

  const theme = themeStyles[settings.theme] || themeStyles.light

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    'X-Admin-Token': token || ''
  }), [token])

  const authenticated = !!token

  const saveToken = () => {
    localStorage.setItem('codemuse_admin_token', inputToken)
    setToken(inputToken)
    setInputToken('')
  }

  const logout = () => {
    localStorage.removeItem('codemuse_admin_token')
    setToken('')
    setStats(null)
    setLogs([])
    setKeys([])
  }

  useEffect(() => {
    if (!authenticated) return

    const fetchAll = async () => {
      try {
        const [s, l, k] = await Promise.all([
          fetch(`${API_BASE_URL}/admin/stats`, { headers }).then(r => r.json()),
          fetch(`${API_BASE_URL}/admin/logs?limit=200`, { headers }).then(r => r.json()),
          fetch(`${API_BASE_URL}/admin/keys`, { headers }).then(r => r.json()),
        ])
        setStats(s)
        setLogs(Array.isArray(l) ? l : [])
        setKeys(Array.isArray(k) ? k : [])
      } catch (e) {
        setError('Failed to load admin data')
      }
    }

    fetchAll()
    const id = setInterval(fetchAll, 5000)
    return () => clearInterval(id)
  }, [authenticated, headers])

  const addKey = async () => {
    if (!newKeyName || !newKeyValue) return
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newKeyName, key: newKeyValue, active: true })
      })
      if (res.ok) {
        const data = await res.json()
        setKeys([data, ...keys])
        setNewKeyName('')
        setNewKeyValue('')
      }
    } catch (e) {}
  }

  const deleteKey = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keys/${id}`, {
        method: 'DELETE',
        headers,
      })
      if (res.ok) {
        setKeys(keys.filter(k => k.id !== id))
      }
    } catch (e) {}
  }

  if (!authenticated) {
    return (
      <div style={{ maxWidth: 420 }}>
        <h2 style={{ color: theme.text, marginBottom: '16px' }}>Admin Login</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={inputToken}
            onChange={e => setInputToken(e.target.value)}
            placeholder="Enter admin token"
            style={{ 
              flex: 1, 
              padding: 8, 
              border: `1px solid ${theme.border}`, 
              borderRadius: 6,
              backgroundColor: theme.surface,
              color: theme.text,
            }}
          />
          <button 
            onClick={saveToken} 
            style={{ 
              padding: '8px 12px', 
              borderRadius: 6, 
              cursor: 'pointer',
              backgroundColor: theme.primary,
              color: 'white',
              border: 'none',
              fontWeight: 500,
            }}
          >
            Login
          </button>
        </div>
        {error && <div style={{ marginTop: 12, color: theme.error }}>{error}</div>}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0, color: theme.text }}>Admin Dashboard</h2>
        <button 
          onClick={logout} 
          style={{ 
            padding: '6px 10px', 
            border: `1px solid ${theme.border}`, 
            borderRadius: 6, 
            cursor: 'pointer',
            backgroundColor: theme.surfaceElevated,
            color: theme.text,
            fontWeight: 500,
          }}
        >
          Logout
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12, backgroundColor: theme.surfaceElevated }}>
            <div style={{ color: theme.textSecondary, fontSize: 12 }}>Total Requests</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{stats.total_requests}</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12, backgroundColor: theme.surfaceElevated }}>
            <div style={{ color: theme.textSecondary, fontSize: 12 }}>Errors</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{stats.total_errors}</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12, backgroundColor: theme.surfaceElevated }}>
            <div style={{ color: theme.textSecondary, fontSize: 12 }}>Avg Latency</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{stats.avg_latency_ms.toFixed(1)} ms</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12, backgroundColor: theme.surfaceElevated }}>
            <div style={{ color: theme.textSecondary, fontSize: 12 }}>P95 Latency</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{stats.p95_latency_ms.toFixed(0)} ms</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12, backgroundColor: theme.surfaceElevated }}>
            <div style={{ color: theme.textSecondary, fontSize: 12 }}>Last 1h Requests</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{stats.last_1h_requests}</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12, backgroundColor: theme.surfaceElevated }}>
            <div style={{ color: theme.textSecondary, fontSize: 12 }}>Last 1h Avg</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{stats.last_1h_avg_latency_ms.toFixed(1)} ms</div>
          </div>
        </div>
      )}

      {/* Keys */}
      <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16, backgroundColor: theme.surfaceElevated }}>
        <div style={{ padding: 12, background: theme.surface, borderBottom: `1px solid ${theme.border}`, color: theme.text, fontWeight: 600 }}>API Keys</div>
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name"
              style={{ 
                flex: 1, 
                padding: 8, 
                border: `1px solid ${theme.border}`, 
                borderRadius: 6,
                backgroundColor: theme.surface,
                color: theme.text,
              }}
            />
            <input
              value={newKeyValue}
              onChange={e => setNewKeyValue(e.target.value)}
              placeholder="Key value"
              style={{ 
                flex: 2, 
                padding: 8, 
                border: `1px solid ${theme.border}`, 
                borderRadius: 6,
                backgroundColor: theme.surface,
                color: theme.text,
              }}
            />
            <button 
              onClick={addKey} 
              style={{ 
                padding: '8px 12px', 
                borderRadius: 6, 
                cursor: 'pointer',
                backgroundColor: theme.primary,
                color: 'white',
                border: 'none',
                fontWeight: 500,
              }}
            >
              Add
            </button>
          </div>

          {keys.length === 0 ? (
            <div style={{ color: theme.textSecondary }}>No keys.</div>
          ) : (
            <div>
              {keys.map(k => (
                <div key={k.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${theme.borderLight}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: theme.text }}>{k.name}</div>
                    <div style={{ fontSize: 12, color: theme.textSecondary }}>{k.mask}</div>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textSecondary }}>Active: {k.active ? 'Yes' : 'No'}</div>
                  <button 
                    onClick={() => deleteKey(k.id)} 
                    style={{ 
                      padding: '6px 10px', 
                      border: `1px solid ${theme.border}`, 
                      borderRadius: 6, 
                      cursor: 'pointer',
                      backgroundColor: theme.surface,
                      color: theme.text,
                      fontWeight: 500,
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Logs */}
      <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, overflow: 'hidden', backgroundColor: theme.surfaceElevated }}>
        <div style={{ padding: 12, background: theme.surface, borderBottom: `1px solid ${theme.border}`, color: theme.text, fontWeight: 600 }}>Recent Logs</div>
        <div style={{ maxHeight: 360, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: theme.surface }}>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}`, color: theme.text }}>Time</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}`, color: theme.text }}>Method</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}`, color: theme.text }}>Path</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}`, color: theme.text }}>Status</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}`, color: theme.text }}>Latency</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}`, color: theme.text }}>Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.borderLight}`, color: theme.text }}>{new Date(l.timestamp).toLocaleString()}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.borderLight}`, color: theme.text }}>{l.method}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.borderLight}`, color: theme.text }}>{l.path}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.borderLight}`, color: theme.text }}>{l.status_code}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.borderLight}`, color: theme.text }}>{l.latency_ms} ms</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.borderLight}`, color: l.error ? theme.error : theme.text }}>{l.error || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
