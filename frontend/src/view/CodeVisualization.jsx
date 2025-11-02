import React, { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';

const API_BASE_URL = 'http://localhost:8000';

export default function CodeVisualization({ code, onGraphData }) {
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
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Generating visualization...</div>
          <div style={{ color: '#666' }}>Analyzing code structure and dependencies</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#fee',
        border: '1px solid #fcc',
        borderRadius: '6px',
        color: '#c00',
      }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!filteredData || !filteredData.nodes || filteredData.nodes.length === 0) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#666' }}>
          {code ? 'No graph data available. Paste some code and generate an explanation.' : 'Enter code to visualize its structure'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      border: '1px solid #e0e0e0', 
      borderRadius: '8px', 
      overflow: 'hidden',
      backgroundColor: '#fff',
    }}>
      {/* Controls */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', fontWeight: '500', color: '#555' }}>
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
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: '#fff',
              cursor: 'pointer',
            }}
          >
            <option value="all">All</option>
            <option value="function">Functions</option>
            <option value="class">Classes</option>
            <option value="variable">Variables</option>
          </select>
        </div>
        
        <div style={{ fontSize: '12px', color: '#666' }}>
          {filteredData.nodes.length} nodes, {filteredData.links.length} edges
        </div>
      </div>

      {/* Legend */}
      <div style={{
        padding: '8px 16px',
        backgroundColor: '#fafafa',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        gap: '16px',
        fontSize: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontWeight: '500', color: '#555' }}>Nodes:</span>
          <span><span style={{ color: '#26a69a' }}>●</span> Function</span>
          <span><span style={{ color: '#42a5f5' }}>●</span> Method</span>
          <span><span style={{ color: '#ef5350' }}>●</span> Class</span>
          <span><span style={{ color: '#ffa726' }}>●</span> Variable</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontWeight: '500', color: '#555' }}>Edges:</span>
          <span><span style={{ color: '#42a5f5' }}>─</span> Calls</span>
          <span><span style={{ color: '#ef5350' }}>─</span> Inherits</span>
          <span><span style={{ color: '#66bb6a' }}>─</span> Contains</span>
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
              width: '36px',
              height: '36px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
              width: '36px',
              height: '36px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
              width: '36px',
              height: '36px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
          padding: '16px',
          backgroundColor: '#f9f9f9',
          borderTop: '1px solid #e0e0e0',
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong style={{ fontSize: '16px', color: '#333' }}>{selectedNode.label}</strong>
            <span style={{ marginLeft: '8px', color: '#666', fontSize: '14px' }}>
              ({selectedNode.type})
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
            Full name: {selectedNode.full_name}
          </div>
          {selectedNode.line && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              Line: {selectedNode.line}
            </div>
          )}
          {selectedNode.bases && selectedNode.bases.length > 0 && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Inherits from: {selectedNode.bases.join(', ')}
            </div>
          )}
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              marginTop: '12px',
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

