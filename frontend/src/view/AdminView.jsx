import React, { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = 'http://localhost:8000'

export default function AdminView() {
  const [token, setToken] = useState(localStorage.getItem('codemuse_admin_token') || '')
  const [inputToken, setInputToken] = useState('')
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState([])
  const [keys, setKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [error, setError] = useState(null)

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
        <h2>Admin Login</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={inputToken}
            onChange={e => setInputToken(e.target.value)}
            placeholder="Enter admin token"
            style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
          />
          <button onClick={saveToken} style={{ padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Login</button>
        </div>
        {error && <div style={{ marginTop: 12, color: '#c00' }}>{error}</div>}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Admin Dashboard</h2>
        <button onClick={logout} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>Logout</button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#666', fontSize: 12 }}>Total Requests</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.total_requests}</div>
          </div>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#666', fontSize: 12 }}>Errors</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.total_errors}</div>
          </div>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#666', fontSize: 12 }}>Avg Latency</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.avg_latency_ms.toFixed(1)} ms</div>
          </div>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#666', fontSize: 12 }}>P95 Latency</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.p95_latency_ms.toFixed(0)} ms</div>
          </div>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#666', fontSize: 12 }}>Last 1h Requests</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.last_1h_requests}</div>
          </div>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#666', fontSize: 12 }}>Last 1h Avg</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.last_1h_avg_latency_ms.toFixed(1)} ms</div>
          </div>
        </div>
      )}

      {/* Keys */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: 12, background: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>API Keys</div>
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name"
              style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            />
            <input
              value={newKeyValue}
              onChange={e => setNewKeyValue(e.target.value)}
              placeholder="Key value"
              style={{ flex: 2, padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            />
            <button onClick={addKey} style={{ padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Add</button>
          </div>

          {keys.length === 0 ? (
            <div style={{ color: '#666' }}>No keys.</div>
          ) : (
            <div>
              {keys.map(k => (
                <div key={k.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{k.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{k.mask}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>Active: {k.active ? 'Yes' : 'No'}</div>
                  <button onClick={() => deleteKey(k.id)} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Logs */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: 12, background: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>Recent Logs</div>
        <div style={{ maxHeight: 360, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Time</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Method</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Path</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Status</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Latency</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #f2f2f2' }}>{new Date(l.timestamp).toLocaleString()}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f2f2f2' }}>{l.method}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f2f2f2' }}>{l.path}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f2f2f2' }}>{l.status_code}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f2f2f2' }}>{l.latency_ms} ms</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f2f2f2', color: '#c00' }}>{l.error || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
