import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useSettings } from '../context/SettingsContext';

const API_BASE_URL = 'http://localhost:8000';

const PRIORITY_COLORS = {
  high: '#f85149',
  medium: '#d29922',
  low: '#3fb950',
};

const CATEGORY_ICONS = {
  refactoring: '',
  complexity: '',
  security: '',
  performance: '',
  other: '',
};

const CATEGORY_LABELS = {
  refactoring: 'Refactoring',
  complexity: 'Complexity',
  security: 'Security',
  performance: 'Performance',
  other: 'Other',
};

export default function SuggestionsView({ code, shouldFetch = false }) {
  const { settings } = useSettings();
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const themeStyles = {
    light: {
      bg: '#ffffff',
      surface: '#f8f9fa',
      surfaceElevated: '#ffffff',
      text: '#1a1a1a',
      textSecondary: '#6c757d',
      border: '#dee2e6',
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
      primary: '#58a6ff',
      error: '#f85149',
      shadow: '0 2px 8px rgba(0,0,0,0.3)',
    },
  };

  const theme = themeStyles[settings.theme] || themeStyles.light;
  const codeTheme = settings.theme === 'dark' ? vscDarkPlus : oneLight;

  useEffect(() => {
    if (!code || !code.trim() || !shouldFetch) {
      if (!shouldFetch) {
        setSuggestions(null);
        setError(null);
      }
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      setError(null);
      setExpandedSuggestion(null);

      try {
        const response = await axios.post(`${API_BASE_URL}/suggestions`, {
          code: code,
        });

        if (response.data.ok) {
          setSuggestions(response.data);
        } else {
          setError('Failed to load suggestions. Please try again.');
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

    fetchSuggestions();
  }, [code, shouldFetch]);

  const copyToClipboard = async (text, suggestionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(suggestionId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleSuggestion = (index) => {
    setExpandedSuggestion(expandedSuggestion === index ? null : index);
  };

  if (loading) {
    return (
      <div style={{
        padding: '60px 40px',
        textAlign: 'center',
        backgroundColor: theme.surfaceElevated,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`,
        boxShadow: theme.shadow,
      }}>
        <div style={{ fontSize: '18px', color: theme.text, marginBottom: '8px' }}>Analyzing code...</div>
        <div style={{ color: theme.textSecondary }}>Generating improvement suggestions</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '16px 20px',
        backgroundColor: settings.theme === 'dark' ? '#3d1f1f' : '#fff5f5',
        border: `1px solid ${theme.error}`,
        borderRadius: '8px',
        color: theme.error,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div><strong>Error:</strong> {error}</div>
      </div>
    );
  }

  if (!suggestions || !suggestions.suggestions || suggestions.suggestions.length === 0) {
    return (
      <div style={{
        padding: '60px 40px',
        textAlign: 'center',
        backgroundColor: theme.surfaceElevated,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`,
        boxShadow: theme.shadow,
      }}>
        <div style={{ color: theme.text, fontSize: '16px', marginBottom: '8px' }}>
          {code ? 'No suggestions available. The code looks good!' : 'Enter code to get improvement suggestions'}
        </div>
      </div>
    );
  }

  const renderSuggestionCard = (suggestion, index) => {
    const isExpanded = expandedSuggestion === index;
    const priority = suggestion.priority || 'medium';
    const category = suggestion.category || 'other';
    const hasCode = suggestion.current_code || suggestion.recommended_code;

    return (
      <div
        key={index}
        style={{
          marginBottom: '16px',
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: theme.surfaceElevated,
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: isExpanded ? theme.shadow : 'none',
        }}
        onClick={() => toggleSuggestion(index)}
      >
        <div style={{
          padding: '20px',
          backgroundColor: isExpanded ? theme.surface : theme.surfaceElevated,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          transition: 'background-color 0.2s',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '16px', color: theme.text }}>
                {suggestion.title}
              </span>
              <span style={{
                padding: '4px 10px',
                backgroundColor: PRIORITY_COLORS[priority],
                color: 'white',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}>
                {priority}
              </span>
              <span style={{
                padding: '4px 10px',
                backgroundColor: theme.surface,
                color: theme.textSecondary,
                borderRadius: '6px',
                fontSize: '11px',
                textTransform: 'capitalize',
                fontWeight: 500,
              }}>
                {CATEGORY_LABELS[category] || category}
              </span>
            </div>
            {suggestion.line_numbers && (
              <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '4px' }}>
                Lines: {suggestion.line_numbers}
              </div>
            )}
          </div>
          <span style={{ fontSize: '18px', color: theme.textSecondary }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>

        {isExpanded && (
          <div style={{ padding: '20px', backgroundColor: theme.surface, borderTop: `1px solid ${theme.border}` }}>
            <div style={{
              marginBottom: hasCode ? '20px' : '0',
              lineHeight: '1.7',
              color: theme.text,
              whiteSpace: 'pre-wrap',
              fontSize: '14px',
            }}>
              {suggestion.description}
            </div>

            {hasCode && (
              <div style={{ marginTop: '20px' }}>
                {suggestion.current_code && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>
                        Current Code:
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(suggestion.current_code, `current-${index}`);
                        }}
                        style={{
                          padding: '6px 12px',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          backgroundColor: theme.surfaceElevated,
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: theme.text,
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
                        {copiedId === `current-${index}` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ border: `1px solid ${theme.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                      <SyntaxHighlighter
                        language={settings.language || 'python'}
                        style={codeTheme}
                        customStyle={{ margin: 0, fontSize: `${settings.fontSize}px` }}
                      >
                        {suggestion.current_code}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                )}

                {suggestion.recommended_code && (
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: PRIORITY_COLORS.low }}>
                        Recommended Code:
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(suggestion.recommended_code, `recommended-${index}`);
                        }}
                        style={{
                          padding: '6px 12px',
                          border: `1px solid ${PRIORITY_COLORS.low}`,
                          borderRadius: '6px',
                          backgroundColor: settings.theme === 'dark' ? '#1a3d1a' : '#f0f9f0',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: PRIORITY_COLORS.low,
                          fontWeight: 500,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = settings.theme === 'dark' ? '#1f4f1f' : '#e8f5e8';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = settings.theme === 'dark' ? '#1a3d1a' : '#f0f9f0';
                        }}
                      >
                        {copiedId === `recommended-${index}` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ border: `2px solid ${PRIORITY_COLORS.low}`, borderRadius: '8px', overflow: 'hidden' }}>
                      <SyntaxHighlighter
                        language={settings.language || 'python'}
                        style={codeTheme}
                        customStyle={{ margin: 0, fontSize: `${settings.fontSize}px` }}
                      >
                        {suggestion.recommended_code}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const categorizedSuggestions = suggestions.categorized || {};
  const hasCategorized = Object.keys(categorizedSuggestions).length > 0;

  return (
    <div style={{ 
      border: `1px solid ${theme.border}`, 
      borderRadius: '12px', 
      padding: '24px', 
      backgroundColor: theme.surfaceElevated,
      boxShadow: theme.shadow,
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '24px',
          fontWeight: 700,
          color: theme.text,
        }}>
          Improvement Suggestions
        </h3>
        <span style={{ 
          fontSize: '14px', 
          color: theme.textSecondary,
          backgroundColor: theme.surface,
          padding: '6px 12px',
          borderRadius: '6px',
          fontWeight: 500,
        }}>
          {suggestions.total_count || suggestions.suggestions.length} suggestion{suggestions.total_count !== 1 ? 's' : ''}
        </span>
      </div>

      {hasCategorized ? (
        Object.entries(categorizedSuggestions).map(([category, categorySuggestions]) => {
          return (
            <div key={category} style={{ marginBottom: '32px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: `2px solid ${theme.border}`,
              }}>
                <h4 style={{ 
                  margin: 0, 
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.text,
                  textTransform: 'capitalize' 
                }}>
                  {CATEGORY_LABELS[category] || category}
                </h4>
                <span style={{ 
                  fontSize: '12px', 
                  color: theme.textSecondary,
                  backgroundColor: theme.surface,
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}>
                  {categorySuggestions.length}
                </span>
              </div>
              {categorySuggestions.map((suggestion, idx) => {
                const globalIndex = suggestions.suggestions.indexOf(suggestion);
                return renderSuggestionCard(suggestion, globalIndex);
              })}
            </div>
          );
        })
      ) : (
        suggestions.suggestions.map((suggestion, index) => renderSuggestionCard(suggestion, index))
      )}
    </div>
  );
}
