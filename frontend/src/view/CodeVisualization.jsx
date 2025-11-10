import React, { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';
import { useSettings } from '../context/SettingsContext';

const API_BASE_URL = 'http://localhost:8000';

export default function CodeVisualization({ code, onGraphData }) {
  const { settings } = useSettings();
  
  const themeStyles = {
    light: {
      bg: '#ffffff',
      surface: '#f8f9fa',
      surfaceElevated: '#ffffff',
      text: '#1a1a1a',
      textSecondary: '#6c757d',
      border: '#dee2e6',
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
      error: '#f85149',
      shadow: '0 2px 8px rgba(0,0,0,0.3)',
    },
  };

  const theme = themeStyles[settings.theme] || themeStyles.light;
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'function', 'class', 'variable'
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const graphRef = useRef();

  // Fetch graph data from backend
  useEffect(() => {
    if (!code || !code.trim()) {
      setGraphData(null);
      return;
    }

    const fetchGraphData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${API_BASE_URL}/visualize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();
        
        if (data.ok && data.graph) {
          setGraphData(data.graph);
          if (onGraphData) {
            onGraphData(data.graph);
          }
        } else {
          setError(data.detail?.message || 'Failed to generate visualization');
        }
      } catch (err) {
        setError(err.message || 'Unable to connect to backend server');
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, [code, onGraphData]);

  // Filter nodes and links based on selected type
  const filteredData = React.useMemo(() => {
    if (!graphData) return null;

    let filteredNodes = graphData.nodes || [];
    let filteredLinks = graphData.links || graphData.edges || []; // Support both 'links' and 'edges'

    if (filterType !== 'all') {
      filteredNodes = filteredNodes.filter(node => node.group === filterType);
      // Filter links to only include edges between filtered nodes
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = filteredLinks.filter(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      });
    }

    return {
      nodes: filteredNodes,
      links: filteredLinks,
    };
  }, [graphData, filterType]);

  // Handle node click
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    
    // Highlight connected nodes and links
    const nodeIds = new Set([node.id]);
    const linkKeys = new Set();
    
    (filteredData?.links || []).forEach((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (sourceId === node.id || targetId === node.id) {
        linkKeys.add(`${sourceId}->${targetId}`);
        nodeIds.add(sourceId);
        nodeIds.add(targetId);
      }
    });
    
    setHighlightNodes(nodeIds);
    setHighlightLinks(linkKeys);
  }, [filteredData]);

  // Handle background click (deselect)
  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, []);

  // Color function based on node type
  const getNodeColor = useCallback((node) => {
    if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) {
      return '#ccc';
    }
    
    switch (node.group) {
      case 'function':
        return node.is_method ? '#42a5f5' : '#26a69a';
      case 'class':
        return '#ef5350';
      case 'variable':
        return '#ffa726';
      default:
        return '#78909c';
    }
  }, [highlightNodes]);

  // Link color function
  const getLinkColor = useCallback((link) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    const linkKey = `${sourceId}->${targetId}`;
    
    if (highlightLinks.size > 0 && !highlightLinks.has(linkKey)) {
      return '#e0e0e0';
    }
    
    switch (link.type) {
      case 'calls':
        return '#42a5f5';
      case 'inherits':
        return '#ef5350';
      case 'contains':
        return '#66bb6a';
      default:
        return '#78909c';
    }
  }, [highlightLinks]);

  if (loading) {
    return (
      <div style={{ 
        padding: '60px 40px', 
        textAlign: 'center',
        backgroundColor: theme.surfaceElevated,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`,
        boxShadow: theme.shadow,
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <div style={{ fontSize: '18px', color: theme.text, marginBottom: '8px' }}>Generating visualization...</div>
          <div style={{ color: theme.textSecondary }}>Analyzing code structure and dependencies</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '16px 20px',
        backgroundColor: settings.theme === 'dark' ? '#3d1f1f' : '#fff5f5',
        border: `1px solid ${theme.error || '#dc3545'}`,
        borderRadius: '8px',
        color: theme.error || '#dc3545',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '20px' }}>⚠️</span>
        <div><strong>Error:</strong> {error}</div>
      </div>
    );
  }

  if (!filteredData || !filteredData.nodes || filteredData.nodes.length === 0) {
    return (
      <div style={{ 
        padding: '60px 40px', 
        textAlign: 'center',
        backgroundColor: theme.surfaceElevated,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`,
        boxShadow: theme.shadow,
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div style={{ color: theme.text, fontSize: '16px' }}>
            {code ? 'No graph data available. Paste some code and generate an explanation.' : 'Enter code to visualize its structure'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      border: `1px solid ${theme.border}`, 
      borderRadius: '12px', 
      overflow: 'hidden',
      backgroundColor: theme.surfaceElevated,
      boxShadow: theme.shadow,
    }}>
      {/* Controls */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: theme.surface,
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>
            Filter:
          </label>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setSelectedNode(null);
              setHighlightNodes(new Set());
              setHighlightLinks(new Set());
            }}
            style={{
              padding: '8px 12px',
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: theme.surfaceElevated,
              color: theme.text,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <option value="all">All</option>
            <option value="function">Functions</option>
            <option value="class">Classes</option>
            <option value="variable">Variables</option>
          </select>
        </div>
        
        <div style={{ 
          fontSize: '12px', 
          color: theme.textSecondary,
          backgroundColor: theme.surfaceElevated,
          padding: '6px 12px',
          borderRadius: '6px',
          fontWeight: 500,
        }}>
          {filteredData.nodes.length} nodes, {filteredData.links.length} edges
        </div>
      </div>

      {/* Legend */}
      <div style={{
        padding: '12px 20px',
        backgroundColor: theme.surface,
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        gap: '20px',
        fontSize: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: theme.text }}>Nodes:</span>
          <span style={{ color: theme.textSecondary }}><span style={{ color: '#26a69a' }}>●</span> Function</span>
          <span style={{ color: theme.textSecondary }}><span style={{ color: '#42a5f5' }}>●</span> Method</span>
          <span style={{ color: theme.textSecondary }}><span style={{ color: '#ef5350' }}>●</span> Class</span>
          <span style={{ color: theme.textSecondary }}><span style={{ color: '#ffa726' }}>●</span> Variable</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: theme.text }}>Edges:</span>
          <span style={{ color: theme.textSecondary }}><span style={{ color: '#42a5f5' }}>─</span> Calls</span>
          <span style={{ color: theme.textSecondary }}><span style={{ color: '#ef5350' }}>─</span> Inherits</span>
          <span style={{ color: theme.textSecondary }}><span style={{ color: '#66bb6a' }}>─</span> Contains</span>
        </div>
      </div>

      {/* Graph Visualization */}
      <div style={{ position: 'relative' }}>
        <ForceGraph2D
          ref={graphRef}
          graphData={filteredData}
          nodeLabel={node => `${node.label}\n(${node.type})`}
          nodeColor={getNodeColor}
          nodeVal={node => {
            // Size nodes based on type
            if (node.group === 'class') return 8;
            if (node.group === 'function') return 6;
            return 4;
          }}
          linkColor={getLinkColor}
          linkWidth={link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const linkKey = `${sourceId}->${targetId}`;
            return highlightLinks.size > 0 && highlightLinks.has(linkKey) ? 3 : 1.5;
          }}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          linkLabel={link => link.label || link.type}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          cooldownTicks={100}
          onEngineStop={() => {
            if (graphRef.current) {
              graphRef.current.zoomToFit(400, 20);
            }
          }}
          d3Force={{
            linkDistance: 80,
            chargeStrength: -300,
            centerStrength: 0.1,
          }}
          width={800}
          height={600}
        />
        
        {/* Zoom Controls */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <button
            onClick={() => {
              if (graphRef.current) {
                graphRef.current.zoom(1.2, 400);
              }
            }}
            style={{
              width: '40px',
              height: '40px',
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              backgroundColor: theme.surfaceElevated,
              color: theme.text,
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: theme.shadow,
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = theme.surface;
              e.target.style.borderColor = theme.primary;
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = theme.surfaceElevated;
              e.target.style.borderColor = theme.border;
            }}
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => {
              if (graphRef.current) {
                graphRef.current.zoom(0.8, 400);
              }
            }}
            style={{
              width: '40px',
              height: '40px',
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              backgroundColor: theme.surfaceElevated,
              color: theme.text,
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: theme.shadow,
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = theme.surface;
              e.target.style.borderColor = theme.primary;
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = theme.surfaceElevated;
              e.target.style.borderColor = theme.border;
            }}
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => {
              if (graphRef.current) {
                graphRef.current.zoomToFit(400, 20);
              }
            }}
            style={{
              width: '40px',
              height: '40px',
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              backgroundColor: theme.surfaceElevated,
              color: theme.text,
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: theme.shadow,
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = theme.surface;
              e.target.style.borderColor = theme.primary;
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = theme.surfaceElevated;
              e.target.style.borderColor = theme.border;
            }}
            title="Fit to screen"
          >
            ⌂
          </button>
        </div>
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div style={{
          padding: '20px',
          backgroundColor: theme.surface,
          borderTop: `1px solid ${theme.border}`,
        }}>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ fontSize: '18px', color: theme.text, fontWeight: 600 }}>{selectedNode.label}</strong>
            <span style={{ marginLeft: '8px', color: theme.textSecondary, fontSize: '14px' }}>
              ({selectedNode.type})
            </span>
          </div>
          <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '8px' }}>
            Full name: {selectedNode.full_name}
          </div>
          {selectedNode.line && (
            <div style={{ fontSize: '13px', color: theme.textSecondary }}>
              Line: {selectedNode.line}
            </div>
          )}
          {selectedNode.bases && selectedNode.bases.length > 0 && (
            <div style={{ fontSize: '13px', color: theme.textSecondary, marginTop: '12px' }}>
              Inherits from: {selectedNode.bases.join(', ')}
            </div>
          )}
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              backgroundColor: theme.surfaceElevated,
              color: theme.text,
              cursor: 'pointer',
              fontSize: '13px',
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
            Close
          </button>
        </div>
      )}
    </div>
  );
}

