import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useSettings } from '../context/SettingsContext';
import CodeVisualization from './CodeVisualization.jsx';
import SuggestionsView from './SuggestionsView.jsx';

const API_BASE_URL = 'http://localhost:8000';

export default function ExplanationView({ initialCode = '', autoRun = false, onAutoRunConsumed }) {
  const { settings, updateSettings } = useSettings();
  const [code, setCode] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [explanationData, setExplanationData] = useState(null);
  const [expandedCards, setExpandedCards] = useState(new Set());

  useEffect(() => {
    if (typeof initialCode === 'string') {
      setCode(initialCode)
    }
  }, [initialCode])

  useEffect(() => {
    if (autoRun && (initialCode || code)) {
      handleGenerateExplanation()
      if (onAutoRunConsumed) onAutoRunConsumed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun])

  const toggleCard = (path) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedCards(newExpanded);
  };

  const handleGenerateExplanation = async () => {
    if (!code.trim()) {
      setError('Please enter some code to explain.');
      return;
    }

    setLoading(true);
    setError(null);
    setExplanationData(null);
    setExpandedCards(new Set());

    try {
      const response = await axios.post(`${API_BASE_URL}/explain`, {
        code: code,
        detail_level: 'detailed',
        organize_by_structure: true,
        language: settings.language || 'python',
      });

      if (response.data.ok) {
        setExplanationData(response.data);
        setExpandedCards(new Set(['overview']));

        try {
          await axios.post(`${API_BASE_URL}/history`, {
            code: code,
            response: response.data,
            title: undefined,
          })
        } catch (e) {
          // non-fatal
        }
      } else {
        setError('Failed to generate explanation. Please try again.');
      }
    } catch (err) {
      if (err.response) {
        const errorDetail = err.response.data?.detail || {};
        const errorMessage = errorDetail.message || errorDetail.error || 'An error occurred';
        setError(`Error: ${errorMessage}`);
      } else if (err.request) {
        setError('Unable to connect to the backend server. Make sure the server is running on port 8000.');
      } else {
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderExplanationCard = (name, data, path = '') => {
    const fullPath = path ? `${path}.${name}` : name;
    const isExpanded = expandedCards.has(fullPath);
    const hasExplanation = data.explanation !== null && data.explanation !== undefined;
    const hasChildren = data.children && Object.keys(data.children).length > 0;

    return (
      <div key={fullPath} style={{ 
        marginBottom: '16px', 
        border: `1px solid ${theme.border}`, 
        borderRadius: '12px', 
        overflow: 'hidden',
        backgroundColor: theme.surfaceElevated,
        transition: 'all 0.2s',
        boxShadow: isExpanded ? theme.shadow : 'none',
      }}>
        <div
          style={{
            padding: '20px',
            backgroundColor: isExpanded ? theme.surface : theme.surfaceElevated,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'background-color 0.2s',
          }}
          onClick={() => toggleCard(fullPath)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <span style={{ fontSize: '20px' }}>
              {data.type === 'class' ? '📦' : '⚙️'}
            </span>
            <div>
              <span style={{ fontWeight: 600, fontSize: '16px', color: theme.text }}>
                {name}
              </span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span style={{ 
                  fontSize: '12px', 
                  color: theme.textSecondary,
                  padding: '2px 8px',
                  backgroundColor: theme.surface,
                  borderRadius: '4px',
                }}>
                  {data.type}
                </span>
                {data.start_line && data.end_line && (
                  <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                    Lines {data.start_line}-{data.end_line}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!hasExplanation && (
              <span style={{ fontSize: '12px', color: theme.textSecondary }}>No explanation</span>
            )}
            <span style={{ fontSize: '18px', color: theme.textSecondary }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
        {isExpanded && (
          <div style={{ padding: '20px', backgroundColor: theme.surface, borderTop: `1px solid ${theme.border}` }}>
            {hasExplanation && (
              <div style={{ marginBottom: hasChildren ? '20px' : '0' }}>
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: theme.surfaceElevated, 
                  borderRadius: '8px',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap',
                  color: theme.text,
                  fontSize: '14px',
                }}>
                  {data.explanation}
                </div>
              </div>
            )}
            {hasChildren && (
              <div style={{ marginLeft: '16px' }}>
                {Object.entries(data.children).map(([childName, childData]) =>
                  renderExplanationCard(childName, childData, fullPath)
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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
      primaryHover: '#0052a3',
      success: '#28a745',
      error: '#dc3545',
      codeBg: '#f8f9fa',
      shadow: '0 2px 8px rgba(0,0,0,0.08)',
      shadowHover: '0 4px 12px rgba(0,0,0,0.12)',
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
      primaryHover: '#79c0ff',
      success: '#3fb950',
      error: '#f85149',
      codeBg: '#0d1117',
      shadow: '0 2px 8px rgba(0,0,0,0.3)',
      shadowHover: '0 4px 12px rgba(0,0,0,0.4)',
    },
  };

  const theme = themeStyles[settings.theme] || themeStyles.light;
  const codeTheme = settings.theme === 'dark' ? vscDarkPlus : oneLight;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Hero Section */}
      <div style={{ 
        marginBottom: '40px',
        textAlign: 'center',
        padding: '40px 0',
      }}>
        <h1 style={{ 
          fontSize: '36px', 
          fontWeight: 700, 
          marginBottom: '12px',
          ...(settings.theme === 'dark' 
            ? {
                color: '#58a6ff', // Solid bright blue for dark mode - always visible
              }
            : {
                background: `linear-gradient(135deg, ${theme.primary} 0%, #004085 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: theme.primary, // Fallback
              }
          ),
        }}>
          Code Explanation Platform
        </h1>
        <p style={{ 
          fontSize: '18px', 
          color: theme.textSecondary,
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          Paste your code and get AI-powered explanations, visualizations, and improvement suggestions
        </p>
      </div>

      {/* Code Input Section */}
      <div style={{ 
        marginBottom: '32px',
        backgroundColor: theme.surfaceElevated,
        borderRadius: '12px',
        padding: '24px',
        border: `1px solid ${theme.border}`,
        boxShadow: theme.shadow,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <label style={{ fontWeight: 600, fontSize: '16px', color: theme.text }}>
            Your Code
          </label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: theme.textSecondary }}>Language:</span>
            <select
              value={settings.language || 'python'}
              onChange={(e) => updateSettings({ language: e.target.value })}
              style={{
                padding: '8px 12px',
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                backgroundColor: theme.surface,
                color: theme.text,
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <option value="python">🐍 Python</option>
              <option value="javascript">📜 JavaScript</option>
              <option value="java">☕ Java</option>
              <option value="cpp">⚙️ C++</option>
            </select>
          </div>
        </div>
        <div style={{ 
          position: 'relative', 
          border: `2px solid ${theme.border}`, 
          borderRadius: '8px', 
          overflow: 'hidden',
          backgroundColor: theme.codeBg,
        }}>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="def example_function(x, y):&#10;    return x + y"
            style={{
              width: '100%',
              minHeight: '250px',
              padding: '20px',
              fontFamily: '"Fira Code", "Monaco", "Consolas", "Courier New", monospace',
              fontSize: `${settings.fontSize}px`,
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              lineHeight: '1.6',
              backgroundColor: theme.codeBg,
              color: theme.text,
            }}
            spellCheck={false}
          />
        </div>
        <button
          onClick={handleGenerateExplanation}
          disabled={loading}
          style={{
            marginTop: '16px',
            padding: '14px 32px',
            backgroundColor: loading ? theme.border : theme.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 600,
            transition: 'all 0.2s',
            width: '100%',
            boxShadow: loading ? 'none' : theme.shadow,
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.target.style.backgroundColor = theme.primaryHover;
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = theme.shadowHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.target.style.backgroundColor = theme.primary;
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = theme.shadow;
            }
          }}
        >
          {loading ? '⏳ Generating Explanation...' : '🚀 Generate Explanation'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: settings.theme === 'dark' ? '#3d1f1f' : '#fff5f5',
          border: `1px solid ${theme.error}`,
          borderRadius: '8px',
          marginBottom: '24px',
          color: theme.error,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Explanation Results and Visualization */}
      {explanationData && (
        <div style={{ marginTop: '32px' }}>
          {/* Export and Share Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginBottom: '24px', 
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            <button
              onClick={async () => {
                try {
                  const res = await axios.post(`${API_BASE_URL}/export/markdown`, {
                    code: code,
                    explanation_data: { ...explanationData, generated_at: new Date().toISOString() },
                    format: 'markdown',
                  }, { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', 'code_explanation.md');
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                } catch (e) {
                  alert('Failed to export: ' + (e.message || 'Unknown error'));
                }
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: theme.surfaceElevated,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                color: theme.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = theme.surface;
                e.target.style.borderColor = theme.primary;
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = theme.surfaceElevated;
                e.target.style.borderColor = theme.border;
              }}
            >
              📄 Export Markdown
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await axios.post(`${API_BASE_URL}/share`, {
                    code: code,
                    response: explanationData,
                    expires_days: 30,
                  });
                  const url = res.data.url;
                  await navigator.clipboard.writeText(url);
                  alert('Share link copied to clipboard!\n' + url);
                } catch (e) {
                  alert('Failed to create share: ' + (e.message || 'Unknown error'));
                }
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: theme.surfaceElevated,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                color: theme.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = theme.surface;
                e.target.style.borderColor = theme.primary;
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = theme.surfaceElevated;
                e.target.style.borderColor = theme.border;
              }}
            >
              🔗 Share Session
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '24px',
            marginBottom: '32px',
          }}>
            {/* Left Column: Explanations */}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ 
                marginBottom: '20px', 
                fontSize: '24px',
                fontWeight: 700,
                color: theme.text,
              }}>
                📚 Explanation
              </h2>
              
              {/* Overview Card */}
              {explanationData.overview && (
                <div style={{ 
                  marginBottom: '24px', 
                  border: `1px solid ${theme.border}`, 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  backgroundColor: theme.surfaceElevated,
                  boxShadow: expandedCards.has('overview') ? theme.shadow : 'none',
                }}>
                  <div
                    style={{
                      padding: '20px',
                      backgroundColor: settings.theme === 'dark' ? '#1a237e' : '#e3f2fd',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background-color 0.2s',
                    }}
                    onClick={() => toggleCard('overview')}
                  >
                    <div style={{ fontWeight: 600, fontSize: '18px', color: theme.text }}>
                      📋 Overview
                    </div>
                    <span style={{ fontSize: '18px', color: theme.textSecondary }}>
                      {expandedCards.has('overview') ? '▼' : '▶'}
                    </span>
                  </div>
                  {expandedCards.has('overview') && (
                    <div style={{ padding: '20px', backgroundColor: theme.surface, borderTop: `1px solid ${theme.border}` }}>
                      <div style={{ 
                        padding: '16px', 
                        backgroundColor: theme.surfaceElevated, 
                        borderRadius: '8px',
                        lineHeight: '1.7',
                        whiteSpace: 'pre-wrap',
                        color: theme.text,
                        fontSize: '14px',
                      }}>
                        {explanationData.overview}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Structured Explanations */}
              {explanationData.explanations && Object.keys(explanationData.explanations).length > 0 && (
                <div>
                  <h3 style={{ 
                    marginBottom: '16px', 
                    fontSize: '18px',
                    fontWeight: 600,
                    color: theme.text,
                  }}>
                    Code Structure
                  </h3>
                  {Object.entries(explanationData.explanations).map(([name, data]) =>
                    renderExplanationCard(name, data)
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Visualization */}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ 
                marginBottom: '20px', 
                fontSize: '24px',
                fontWeight: 700,
                color: theme.text,
              }}>
                🔍 Data Flow Visualization
              </h2>
              <CodeVisualization code={code} />
            </div>
          </div>

          {/* Suggestions Section - Full Width */}
          <div style={{ marginTop: '40px' }}>
            <SuggestionsView code={code} shouldFetch={true} />
          </div>

          {/* Raw Code Display with Syntax Highlighting - Full Width */}
          {code && (
            <div style={{ marginTop: '40px' }}>
              <h3 style={{ 
                marginBottom: '16px', 
                fontSize: '20px',
                fontWeight: 600,
                color: theme.text,
              }}>
                💻 Your Code
              </h3>
              <div style={{ 
                border: `1px solid ${theme.border}`, 
                borderRadius: '12px', 
                overflow: 'hidden',
                boxShadow: theme.shadow,
              }}>
                <SyntaxHighlighter
                  language={settings.language || 'python'}
                  style={codeTheme}
                  customStyle={{
                    margin: 0,
                    borderRadius: '12px',
                    fontSize: `${settings.fontSize}px`,
                  }}
                  showLineNumbers
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
