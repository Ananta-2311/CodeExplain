import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const API_BASE_URL = 'http://localhost:8000';

const PRIORITY_COLORS = {
  high: '#ef5350',
  medium: '#ffa726',
  low: '#66bb6a',
};

const CATEGORY_ICONS = {
  refactoring: '🔧',
  complexity: '📊',
  security: '🔒',
  performance: '⚡',
  other: '💡',
};

const CATEGORY_LABELS = {
  refactoring: 'Refactoring',
  complexity: 'Complexity',
  security: 'Security',
  performance: 'Performance',
  other: 'Other',
};

export default function SuggestionsView({ code, shouldFetch = false }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

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
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Analyzing code...</div>
          <div style={{ color: '#666' }}>Generating improvement suggestions</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: '#fee',
        border: '1px solid #fcc',
        borderRadius: '6px',
        color: '#c00',
      }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!suggestions || !suggestions.suggestions || suggestions.suggestions.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: '#666' }}>
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
          marginBottom: '12px',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#fff',
          cursor: 'pointer',
        }}
        onClick={() => toggleSuggestion(index)}
      >
        {/* Card Header */}
        <div style={{
          padding: '16px',
          backgroundColor: '#f9f9f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>
                {CATEGORY_ICONS[category] || CATEGORY_ICONS.other}
              </span>
              <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                {suggestion.title}
              </span>
              <span style={{
                padding: '4px 8px',
                backgroundColor: PRIORITY_COLORS[priority],
                color: 'white',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}>
                {priority}
              </span>
              <span style={{
                padding: '4px 8px',
                backgroundColor: '#e0e0e0',
                color: '#666',
                borderRadius: '4px',
                fontSize: '11px',
                textTransform: 'capitalize',
              }}>
                {CATEGORY_LABELS[category] || category}
              </span>
            </div>
            {suggestion.line_numbers && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Lines: {suggestion.line_numbers}
              </div>
            )}
          </div>
          <span style={{ fontSize: '18px', color: '#999' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div style={{ padding: '16px', backgroundColor: '#fff' }}>
            {/* Description */}
            <div style={{
              marginBottom: hasCode ? '16px' : '0',
              lineHeight: '1.6',
              color: '#555',
              whiteSpace: 'pre-wrap',
            }}>
              {suggestion.description}
            </div>

            {/* Code Comparison */}
            {hasCode && (
              <div style={{ marginTop: '16px' }}>
                {suggestion.current_code && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#666' }}>
                        Current Code:
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(suggestion.current_code, `current-${index}`);
                        }}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                      >
                        {copiedId === `current-${index}` ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                    <div style={{ border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
                      <SyntaxHighlighter
                        language="python"
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, fontSize: '12px' }}
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
                      marginBottom: '8px',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#66bb6a' }}>
                        Recommended Code:
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(suggestion.recommended_code, `recommended-${index}`);
                        }}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                      >
                        {copiedId === `recommended-${index}` ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                    <div style={{ border: '1px solid #66bb6a', borderRadius: '6px', overflow: 'hidden' }}>
                      <SyntaxHighlighter
                        language="python"
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, fontSize: '12px' }}
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

  // Group suggestions by category if categorized data is available
  const categorizedSuggestions = suggestions.categorized || {};
  const hasCategorized = Object.keys(categorizedSuggestions).length > 0;

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: '#333', fontSize: '18px' }}>💡 Improvement Suggestions</h3>
        <span style={{ fontSize: '14px', color: '#666' }}>
          {suggestions.total_count || suggestions.suggestions.length} suggestion{suggestions.total_count !== 1 ? 's' : ''}
        </span>
      </div>

      {hasCategorized ? (
        // Display by category
        Object.entries(categorizedSuggestions).map(([category, categorySuggestions]) => {
          let suggestionIndex = 0;
          return (
            <div key={category} style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '2px solid #e0e0e0',
              }}>
                <span style={{ fontSize: '18px' }}>{CATEGORY_ICONS[category] || CATEGORY_ICONS.other}</span>
                <h4 style={{ margin: 0, color: '#555', fontSize: '16px', textTransform: 'capitalize' }}>
                  {CATEGORY_LABELS[category] || category}
                </h4>
                <span style={{ fontSize: '12px', color: '#999' }}>
                  ({categorySuggestions.length})
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
        // Display all suggestions in a flat list
        suggestions.suggestions.map((suggestion, index) => renderSuggestionCard(suggestion, index))
      )}
    </div>
  );
}

