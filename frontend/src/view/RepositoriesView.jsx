/**
 * Repository zip upload, file tree, AI project overview, and context-aware chat.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext'

const API_BASE_URL = 'http://localhost:8000'

function formatApiError(data) {
  const d = data?.detail
  if (!d) return data?.message || 'Request failed'
  if (typeof d === 'string') return d
  return d.message || d.error || 'Request failed'
}

/** Recursive file tree with correct repo-relative paths. */
function FileTreePanel({ tree, theme, onSelectFile, selectedPath }) {
  const buildPath = (node, prefix) => {
    if (node.type === 'file') {
      const path = prefix ? `${prefix}/${node.name}` : node.name
      return (
        <div
          key={path}
          role="button"
          tabIndex={0}
          onClick={() => onSelectFile(path)}
          onKeyDown={(e) => e.key === 'Enter' && onSelectFile(path)}
          style={{
            padding: `4px 8px 4px ${8 + (prefix.split('/').filter(Boolean).length) * 14}px`,
            cursor: 'pointer',
            fontSize: '13px',
            borderRadius: '4px',
            backgroundColor: selectedPath === path ? theme.selectedBg : 'transparent',
            color: theme.text,
          }}
        >
          {node.name}
        </div>
      )
    }
    const base = prefix ? `${prefix}/${node.name}` : node.name
    return (
      <div key={base}>
        <div style={{
          padding: `6px 8px 4px ${8 + (prefix.split('/').filter(Boolean).length) * 14}px`,
          fontWeight: 600,
          fontSize: '13px',
          color: theme.textSecondary,
        }}>
          {node.name}/
        </div>
        {(node.children || []).map((ch) => buildPath(ch, base))}
      </div>
    )
  }

  if (!tree || !tree.length) {
    return <div style={{ color: theme.textSecondary, fontSize: '13px' }}>No files</div>
  }
  return (
    <div style={{ maxHeight: '42vh', overflowY: 'auto' }}>
      {tree.map((node, i) => (
        <React.Fragment key={`${node.name}-${i}`}>{buildPath(node, '')}</React.Fragment>
      ))}
    </div>
  )
}

export default function RepositoriesView() {
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
      selectedBg: '#e3f2fd',
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
      selectedBg: '#1a237e',
    },
  }

  const theme = {
    ...(themeStyles[settings.theme] || themeStyles.light),
    selectedBg: settings.theme === 'dark' ? '#1a237e' : '#e3f2fd',
  }

  const [repos, setRepos] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState(null)

  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState(null)
  const [overviewMessage, setOverviewMessage] = useState(null)
  const [chatBusyMessage, setChatBusyMessage] = useState(null)

  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState(null)

  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)

  const [selectedPath, setSelectedPath] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [fileLoading, setFileLoading] = useState(false)

  const loadRepos = useCallback(async () => {
    setListLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/repositories`)
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data))
      setRepos(data.repositories || [])
    } catch (e) {
      setError(e.message || 'Failed to load repositories')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRepos()
  }, [loadRepos])

  const loadDetail = async (id) => {
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)
    setOverviewError(null)
    setChatError(null)
    setSelectedPath(null)
    setFilePreview(null)
    try {
      const res = await fetch(`${API_BASE_URL}/repositories/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data))
      setDetail(data)
      const msgs = (data.chat_messages || []).map((m) => ({ role: m.role, content: m.content }))
      setChatMessages(msgs)
    } catch (e) {
      setError(e.message || 'Failed to load repository')
    } finally {
      setDetailLoading(false)
    }
  }

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please choose a .zip file.')
      return
    }
    setUploading(true)
    setUploadMessage('Uploading repository...')
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API_BASE_URL}/repositories/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data))
      await loadRepos()
      await loadDetail(data.repo_id)
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      setUploadMessage(null)
    }
  }

  const generateOverview = async () => {
    if (!selectedId) return
    setOverviewLoading(true)
    setOverviewMessage('Analyzing project...')
    setOverviewError(null)
    try {
      const regenerate = Boolean(detail?.overview)
      const res = await fetch(`${API_BASE_URL}/repositories/${selectedId}/overview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data))
      setDetail((d) => (d ? { ...d, overview: data.overview } : d))
    } catch (e) {
      setOverviewError(e.message || 'Failed to generate overview')
    } finally {
      setOverviewLoading(false)
      setOverviewMessage(null)
    }
  }

  const loadFile = async (path) => {
    if (!selectedId || !path) return
    setSelectedPath(path)
    setFileLoading(true)
    setFilePreview(null)
    try {
      const q = encodeURIComponent(path)
      const res = await fetch(`${API_BASE_URL}/repositories/${selectedId}/file?path=${q}`)
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data))
      setFilePreview(data.content)
    } catch (e) {
      setFilePreview(`(Error: ${e.message})`)
    } finally {
      setFileLoading(false)
    }
  }

  const sendChat = async () => {
    const q = chatInput.trim()
    if (!q || !selectedId || chatLoading) return
    setChatInput('')
    setChatLoading(true)
    setChatError(null)
    setChatBusyMessage('Thinking with repo context...')
    const historyPayload = chatMessages.map((m) => ({ role: m.role, content: m.content }))
    try {
      const res = await fetch(`${API_BASE_URL}/repositories/${selectedId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history: historyPayload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data))
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: q },
        { role: 'assistant', content: data.answer, refs: data.referenced_files || [] },
      ])
    } catch (e) {
      setChatError(e.message || 'Chat failed')
      setChatInput(q)
    } finally {
      setChatLoading(false)
      setChatBusyMessage(null)
    }
  }

  const panelStyle = {
    border: `1px solid ${theme.border}`,
    borderRadius: '12px',
    backgroundColor: theme.surfaceElevated,
    boxShadow: theme.shadow,
    overflow: 'hidden',
  }

  return (
    <div>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h2 style={{ marginTop: 0, fontSize: '32px', fontWeight: 700, color: theme.text, marginBottom: '8px' }}>
          Repositories
        </h2>
        <p style={{ color: theme.textSecondary, fontSize: '16px' }}>
          Upload a codebase, get an AI overview, and ask questions with full-repo context
        </p>
      </div>

      {(uploadMessage || overviewMessage || chatBusyMessage) && (
        <div style={{
          textAlign: 'center',
          padding: '12px',
          marginBottom: '16px',
          backgroundColor: theme.surface,
          borderRadius: '8px',
          color: theme.primary,
          fontWeight: 500,
        }}>
          {uploadMessage || overviewMessage || chatBusyMessage}
        </div>
      )}

      {error && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: settings.theme === 'dark' ? '#3d1f1f' : '#fff5f5',
          border: `1px solid ${theme.error}`,
          borderRadius: '8px',
          marginBottom: '24px',
          color: theme.error,
        }}>
          {error}
        </div>
      )}

      <div style={{ ...panelStyle, padding: '20px', marginBottom: '24px' }}>
        <div style={{ fontWeight: 600, marginBottom: '12px', color: theme.text }}>Upload repository (.zip)</div>
        <label style={{
          display: 'inline-block',
          padding: '12px 24px',
          backgroundColor: theme.primary,
          color: '#fff',
          borderRadius: '8px',
          cursor: uploading ? 'wait' : 'pointer',
          fontWeight: 600,
          opacity: uploading ? 0.7 : 1,
        }}>
          {uploading ? 'Uploading…' : 'Choose zip file'}
          <input type="file" accept=".zip" disabled={uploading} style={{ display: 'none' }} onChange={onUpload} />
        </label>
        <span style={{ marginLeft: '16px', color: theme.textSecondary, fontSize: '14px' }}>
          Max ~300 MB per upload. Large folders (node_modules, .git, …) are skipped automatically.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div style={panelStyle}>
          <div style={{
            padding: '14px 16px',
            background: theme.surface,
            borderBottom: `1px solid ${theme.border}`,
            fontWeight: 600,
            color: theme.text,
          }}>
            Your repositories ({repos.length})
          </div>
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {listLoading && (
              <div style={{ padding: '24px', color: theme.textSecondary }}>Loading…</div>
            )}
            {!listLoading && repos.map((r) => (
              <div
                key={r.repo_id}
                onClick={() => loadDetail(r.repo_id)}
                style={{
                  padding: '14px 16px',
                  borderBottom: `1px solid ${theme.border}`,
                  cursor: 'pointer',
                  backgroundColor: selectedId === r.repo_id ? theme.selectedBg : theme.surfaceElevated,
                  color: theme.text,
                }}
              >
                <div style={{ fontWeight: 600 }}>{r.repo_name}</div>
                <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '4px' }}>
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                </div>
              </div>
            ))}
            {!listLoading && repos.length === 0 && (
              <div style={{ padding: '24px', color: theme.textSecondary, fontSize: '14px' }}>
                No repositories yet. Upload a zip to get started.
              </div>
            )}
          </div>
        </div>

        <div style={{ ...panelStyle, minHeight: '480px' }}>
          <div style={{
            padding: '14px 16px',
            background: theme.surface,
            borderBottom: `1px solid ${theme.border}`,
            fontWeight: 600,
            color: theme.text,
          }}>
            {detail ? detail.repo_name : 'Repository detail'}
          </div>
          <div style={{ padding: '20px' }}>
            {detailLoading && (
              <div style={{ color: theme.textSecondary }}>Loading repository…</div>
            )}
            {!detailLoading && !detail && (
              <div style={{ color: theme.textSecondary, textAlign: 'center', padding: '48px' }}>
                Select a repository or upload a new one
              </div>
            )}
            {!detailLoading && detail && (
              <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '10px', color: theme.text }}>File tree</div>
                  <FileTreePanel
                    tree={detail.file_tree}
                    theme={theme}
                    onSelectFile={loadFile}
                    selectedPath={selectedPath}
                  />
                  {selectedPath && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
                        {selectedPath}
                      </div>
                      {fileLoading ? (
                        <div style={{ fontSize: '13px', color: theme.textSecondary }}>Loading file…</div>
                      ) : (
                        <pre style={{
                          margin: 0,
                          padding: '10px',
                          background: theme.surface,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px',
                          fontSize: '11px',
                          maxHeight: '200px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                        >
                          {filePreview ?? '—'}
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 600, color: theme.text }}>Project overview</span>
                      <button
                        type="button"
                        onClick={() => generateOverview()}
                        disabled={overviewLoading}
                        style={{
                          padding: '8px 14px',
                          backgroundColor: theme.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: overviewLoading ? 'wait' : 'pointer',
                          fontWeight: 600,
                          fontSize: '13px',
                        }}
                      >
                        {detail.overview && !overviewLoading ? 'Regenerate overview' : 'Generate overview'}
                      </button>
                    </div>
                    {overviewError && (
                      <div style={{ color: theme.error, marginBottom: '8px', fontSize: '14px' }}>{overviewError}</div>
                    )}
                    <div style={{
                      padding: '16px',
                      background: theme.surface,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                      whiteSpace: 'pre-wrap',
                      fontSize: '14px',
                      lineHeight: 1.65,
                      color: theme.text,
                      maxHeight: '320px',
                      overflowY: 'auto',
                    }}
                    >
                      {detail.overview || (overviewLoading ? 'Generating…' : 'No overview yet. Click “Generate overview”.')}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '10px', color: theme.text }}>Repository chat</div>
                    <div style={{
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                      background: theme.surface,
                      maxHeight: '280px',
                      overflowY: 'auto',
                      padding: '12px',
                      marginBottom: '10px',
                    }}
                    >
                      {chatMessages.length === 0 && (
                        <div style={{ color: theme.textSecondary, fontSize: '14px' }}>
                          Ask about architecture, auth, data flow, or where something is implemented.
                        </div>
                      )}
                      {chatMessages.map((m, i) => (
                        <div
                          key={i}
                          style={{
                            marginBottom: '12px',
                            textAlign: m.role === 'user' ? 'right' : 'left',
                          }}
                        >
                          <div style={{
                            display: 'inline-block',
                            maxWidth: '92%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: m.role === 'user' ? theme.primary : theme.surfaceElevated,
                            color: m.role === 'user' ? '#fff' : theme.text,
                            whiteSpace: 'pre-wrap',
                            fontSize: '14px',
                            lineHeight: 1.5,
                            border: m.role === 'assistant' ? `1px solid ${theme.border}` : 'none',
                          }}
                        >
                          {m.content}
                          {m.role === 'assistant' && m.refs && m.refs.length > 0 && (
                            <div style={{
                              marginTop: '10px',
                              paddingTop: '8px',
                              borderTop: `1px solid ${theme.border}`,
                              fontSize: '12px',
                              color: theme.textSecondary,
                              textAlign: 'left',
                            }}
                            >
                              <span style={{ fontWeight: 600 }}>Referenced files: </span>
                              {m.refs.join(', ')}
                            </div>
                          )}
                        </div>
                        </div>
                      ))}
                    </div>
                    {chatError && (
                      <div style={{ color: theme.error, marginBottom: '8px', fontSize: '14px' }}>{chatError}</div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
                        placeholder="Ask about this project…"
                        disabled={chatLoading}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: theme.surfaceElevated,
                          color: theme.text,
                          fontSize: '14px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={sendChat}
                        disabled={chatLoading || !chatInput.trim()}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: theme.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 600,
                          cursor: chatLoading ? 'wait' : 'pointer',
                        }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
