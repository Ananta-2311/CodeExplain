import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useSettings } from '../context/SettingsContext'
import ExplanationView from './ExplanationView.jsx'

const API_BASE_URL = 'http://localhost:8000'

export default function ShareView({ token }) {
  const { settings } = useSettings()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [code, setCode] = useState('')
  const [autoRun, setAutoRun] = useState(false)

  const themeStyles = {
    light: {
      bg: '#ffffff',
      surface: '#f8f9fa',
      text: '#1a1a1a',
      textSecondary: '#6c757d',
      border: '#dee2e6',
      primary: '#0066cc',
      error: '#dc3545',
    },
    dark: {
      bg: '#0d1117',
      surface: '#161b22',
      text: '#e6edf3',
      textSecondary: '#8b949e',
      border: '#30363d',
      primary: '#58a6ff',
      error: '#f85149',
    },
  }

  const theme = themeStyles[settings.theme] || themeStyles.light

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
    return (
      <div style={{ 
        padding: '60px 40px', 
        textAlign: 'center',
        backgroundColor: theme.surface,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`,
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <div style={{ fontSize: '18px', color: theme.text }}>Loading shared session...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: theme.surface,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`,
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <div style={{ 
          color: theme.error, 
          marginBottom: 24,
          fontSize: '18px',
          fontWeight: 600,
        }}>
          {error}
        </div>
        <a 
          href="/" 
          style={{ 
            color: theme.primary,
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
        >
          ← Go back to home
        </a>
      </div>
    )
  }

  return (
    <div>
      <div style={{ 
        padding: '20px', 
        background: settings.theme === 'dark' ? '#1a237e' : '#e3f2fd', 
        borderRadius: '12px', 
        marginBottom: '24px',
        border: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '24px' }}>📤</span>
        <div>
          <strong style={{ fontSize: '16px', color: theme.text }}>Shared Session</strong>
          <div style={{ fontSize: '14px', color: theme.textSecondary, marginTop: '4px' }}>
            This explanation was shared with you.
          </div>
        </div>
      </div>
      <ExplanationView initialCode={code} autoRun={autoRun} onAutoRunConsumed={() => setAutoRun(false)} />
    </div>
  )
}
