import React, { useState } from 'react';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CodeVisualization from './CodeVisualization.jsx';

const API_BASE_URL = 'http://localhost:8000'; // Default FastAPI port

export default function ExplanationView() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [explanationData, setExplanationData] = useState(null);
  const [expandedCards, setExpandedCards] = useState(new Set());

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
      });

      if (response.data.ok) {
        setExplanationData(response.data);
        // Auto-expand overview
        setExpandedCards(new Set(['overview']));
      } else {
        setError('Failed to generate explanation. Please try again.');
      }
    } catch (err) {
      if (err.response) {
        // Server responded with error
        const errorDetail = err.response.data?.detail || {};
        const errorMessage = errorDetail.message || errorDetail.error || 'An error occurred';
        setError(`Error: ${errorMessage}`);
      } else if (err.request) {
        // Request made but no response
        setError('Unable to connect to the backend server. Make sure the server is running on port 8000.');
      } else {
        // Something else happened
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
      <div key={fullPath} style={{ marginBottom: '12px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f5f5f5',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          onClick={() => toggleCard(fullPath)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
              {data.type === 'class' ? '📦' : '⚙️'} {name}
            </span>
            <span style={{ color: '#666', fontSize: '14px' }}>
              ({data.type})
            </span>
            {data.start_line && data.end_line && (
              <span style={{ color: '#999', fontSize: '12px' }}>
                Lines {data.start_line}-{data.end_line}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!hasExplanation && (
              <span style={{ color: '#999', fontSize: '12px' }}>No explanation</span>
            )}
            <span style={{ fontSize: '18px' }}>{isExpanded ? '▼' : '▶'}</span>
          </div>
        </div>
        {isExpanded && (
          <div style={{ padding: '16px', backgroundColor: '#fff' }}>
            {hasExplanation && (
              <div style={{ marginBottom: hasChildren ? '16px' : '0' }}>
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#f9f9f9', 
                  borderRadius: '6px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap'
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

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', color: '#333' }}>CodeMuse - Code Explanation</h1>
      
      {/* Code Input Section */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#555' }}>
          Paste your Python code:
        </label>
        <div style={{ position: 'relative', border: '2px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="def example_function(x, y):&#10;    return x + y"
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '16px',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '14px',
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              lineHeight: '1.5',
            }}
            spellCheck={false}
          />
        </div>
        <button
          onClick={handleGenerateExplanation}
          disabled={loading}
          style={{
            marginTop: '12px',
            padding: '12px 24px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '600',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!loading) e.target.style.backgroundColor = '#0056b3';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.target.style.backgroundColor = '#007bff';
          }}
        >
          {loading ? 'Generating Explanation...' : 'Generate Explanation'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '6px',
          marginBottom: '24px',
          color: '#c00',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Explanation Results and Visualization */}
      {explanationData && (
        <div style={{ marginTop: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '24px',
            marginBottom: '32px',
          }}>
            {/* Left Column: Explanations */}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ marginBottom: '16px', color: '#333' }}>Explanation</h2>
              
              {/* Overview Card */}
              {explanationData.overview && (
                <div style={{ marginBottom: '24px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: '#e3f2fd',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => toggleCard('overview')}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                      📋 Overview
                    </div>
                    <span style={{ fontSize: '18px' }}>
                      {expandedCards.has('overview') ? '▼' : '▶'}
                    </span>
                  </div>
                  {expandedCards.has('overview') && (
                    <div style={{ padding: '16px', backgroundColor: '#fff' }}>
                      <div style={{ 
                        padding: '12px', 
                        backgroundColor: '#f9f9f9', 
                        borderRadius: '6px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap'
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
                  <h3 style={{ marginBottom: '16px', color: '#555' }}>Code Structure</h3>
                  {Object.entries(explanationData.explanations).map(([name, data]) =>
                    renderExplanationCard(name, data)
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Visualization */}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ marginBottom: '16px', color: '#333' }}>Data Flow Visualization</h2>
              <CodeVisualization code={code} />
            </div>
          </div>

          {/* Raw Code Display with Syntax Highlighting - Full Width */}
          {code && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ marginBottom: '16px', color: '#555' }}>Your Code</h3>
              <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                <SyntaxHighlighter
                  language="python"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    borderRadius: '8px',
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

