import React, { useEffect, useState } from 'react'
import axios from 'axios'
import ExplanationView from './ExplanationView.jsx'

const API_BASE_URL = 'http://localhost:8000'

export default function ShareView({ token }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [code, setCode] = useState('')
  const [autoRun, setAutoRun] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/share/${token}`)
        if (res.data.ok) {
          setCode(res.data.code)
          setAutoRun(true)
        } else {
          setError('Failed to load shared session')
        }
      } catch (e) {
        if (e.response?.status === 404) {
          setError('Shared session not found')
        } else if (e.response?.status === 410) {
          setError('This shared session has expired')
        } else {
          setError('Failed to load shared session: ' + (e.message || 'Unknown error'))
        }
      } finally {
        setLoading(false)
      }
    }
    if (token) {
      load()
    }
  }, [token])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading shared session...</div>
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#c00', marginBottom: 16 }}>{error}</div>
        <a href="/" style={{ color: '#007bff' }}>Go back to home</a>
      </div>
    )
  }

  return (
    <div>
      <div style={{ padding: 16, background: '#e3f2fd', borderRadius: 8, marginBottom: 16 }}>
        <strong>📤 Shared Session</strong> - This explanation was shared with you.
      </div>
      <ExplanationView initialCode={code} autoRun={autoRun} onAutoRunConsumed={() => setAutoRun(false)} />
    </div>
  )
}

